-- =============================================================================
-- WEALTH OS — Migration 0015: update_transfer() RPC
--
-- Found via user report: a transfer transaction ("โอนเงิน") had no "แก้ไข"
-- (Edit) option — only Delete — because create_transfer() (0001_init.sql)
-- only ever supported inserting a new transfer, and no update counterpart
-- existed. A transfer is a single row (from_account_id/to_account_id on
-- one `transactions` row, not two linked rows — see 0001_init.sql's header
-- reason #3), so a real edit needs to change that one row in place,
-- including which two accounts it points at.
--
-- Mirrors create_transfer()'s own validation (distinct accounts, positive
-- amount, both accounts belong to auth.uid(), same currency) rather than
-- relying on a bare client-side `.update()` — centralizing it here, in one
-- tested path, exactly like create_transfer()'s own doc comment already
-- argues for. SECURITY INVOKER (the default, same as create_transfer): the
-- UPDATE inside still runs as the calling user, so the existing
-- transactions_update_own RLS policy's `with check` (0001_init.sql) is a
-- second, independent layer verifying from_account_id/to_account_id
-- ownership — this function's own checks are not the only thing standing
-- between a request and another user's account.
--
-- No idempotency-key parameter (unlike create_transfer): a retried UPDATE
-- targeting the same p_transaction_id just re-applies to that same row —
-- there is no "insert a second row" failure mode an edit could hit, so
-- there's nothing here for a key to protect against.
--
-- Balance correctness after the edit — old accounts, new accounts, amount
-- changes, all of it — needs no bespoke logic: trg_recalc_account_balances
-- (0001_init.sql) already fires on UPDATE and recalculates every account
-- named in OLD.from_account_id/OLD.to_account_id/NEW.from_account_id/
-- NEW.to_account_id from a full resum of that account's transactions, not
-- an incremental adjustment — so a plain column UPDATE is already correct
-- for any combination of what changed, including a full account swap.
-- =============================================================================
create or replace function public.update_transfer(
  p_transaction_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_description text default null,
  p_notes text default null
)
returns public.transactions
language plpgsql
as $$
declare
  v_from_currency text;
  v_to_currency text;
  v_row public.transactions;
begin
  if p_from_account_id = p_to_account_id then
    raise exception 'from_account_id and to_account_id must differ';
  end if;

  if p_amount <= 0 then
    raise exception 'amount must be greater than zero';
  end if;

  select currency_code into v_from_currency
  from public.accounts
  where id = p_from_account_id and user_id = auth.uid();

  select currency_code into v_to_currency
  from public.accounts
  where id = p_to_account_id and user_id = auth.uid();

  if v_from_currency is null or v_to_currency is null then
    raise exception 'both accounts must exist and belong to the current user';
  end if;

  if v_from_currency <> v_to_currency then
    raise exception 'cross-currency transfers are not supported yet (% -> %)',
      v_from_currency, v_to_currency;
  end if;

  update public.transactions
  set
    amount = p_amount,
    currency_code = v_from_currency,
    transaction_date = p_transaction_date,
    description = p_description,
    notes = p_notes,
    from_account_id = p_from_account_id,
    to_account_id = p_to_account_id
  where id = p_transaction_id
    and user_id = auth.uid()
    and type = 'transfer'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'transfer not found or not owned by the current user';
  end if;

  return v_row;
end;
$$;
