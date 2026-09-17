-- =============================================================================
-- WEALTH OS — Migration 0012: Transaction create idempotency
--
-- Found during the /money/transactions First Value audit and hardened during
-- the Financial Data Integrity pass that followed it: a rapid double-click
-- or a network retry on "save transaction" can invoke
-- createTransaction()/createTransfer() twice before the client's `disabled`
-- state takes effect, inserting two identical rows for one user action.
--
-- Unlike onboarding (a one-time action with a natural `onboarding_completed`
-- flag to compare-and-swap against), a transaction has no such flag — the
-- same user legitimately creates many similar-looking transactions over
-- time (two separate ฿80 coffees is a real, valid case), so a uniqueness
-- rule on business columns (account/type/amount/date) would incorrectly
-- block genuine transactions. An interim time-window content-based check
-- was tried first and rejected (see PROJECT_STATUS.md / git history) — it
-- is a check-then-insert heuristic, not atomic, and cannot distinguish "the
-- same submit attempt, retried" from "a different, coincidentally similar
-- transaction."
--
-- The correct model — the same one every real-world payment API uses for
-- exactly this problem — is a client-generated idempotency key, unique per
-- *submit attempt*, never per transaction's business data:
--
--   - The client generates one fresh random UUID when a transaction/
--     transfer form opens (or is reset after a successful save) and resends
--     the SAME value on every retry of that one attempt.
--   - Two genuinely separate transactions always carry two different keys,
--     so correctness never depends on the transaction's content — the
--     ฿80-coffee-twice case (Scenario C) is unaffected.
--   - The database enforces uniqueness per (user_id, client_request_id) —
--     a single atomic constraint checked as part of the INSERT itself, with
--     no check-then-act gap, and correct across any number of concurrent
--     server instances (the constraint lives in Postgres, not in a
--     per-process in-memory map).
--
-- Purely additive: one nullable column plus a partial unique index (only
-- enforced when a key is actually provided), so existing rows and any
-- other insert path into this table (seed data, recurring-transaction
-- automation) are entirely unaffected — a NULL key never collides with
-- anything, by ordinary SQL NULL-inequality semantics for unique indexes.
-- =============================================================================

alter table public.transactions
  add column client_request_id uuid;

comment on column public.transactions.client_request_id is
  'Client-generated idempotency key for one create-transaction/create-transfer submit attempt. NULL for rows inserted without one (e.g. seed data, recurring-transaction automation, or an old client — see actions.ts) — never required, only used to make a client retry of the same submit attempt safe.';

-- Partial (not a plain per-user unique index) so it only ever constrains
-- rows that actually opted in by supplying a key. This is the single
-- source of truth for "has this exact submit attempt already happened?" —
-- checked atomically by Postgres as part of every INSERT, not by
-- application code reading-then-writing.
create unique index transactions_user_client_request_id_idx
  on public.transactions (user_id, client_request_id)
  where client_request_id is not null;

-- =============================================================================
-- create_transfer(): add idempotency-key support.
--
-- A transfer is a single-row insert already (see 0001_init.sql's header,
-- reason #3), so the SAME unique index above covers it with no separate
-- mechanism. The only addition needed is accepting the key and, on a
-- retried attempt (unique-violation on that index), returning the
-- ALREADY-CREATED row instead of raising an error — a retry of a
-- successful transfer must never look like a failure to the client, and
-- must never debit/credit the two accounts a second time.
--
-- `on conflict ... do update set id = id` is the standard Postgres idiom
-- for making an `ON CONFLICT` clause still `RETURNING` the pre-existing
-- conflicting row (a plain `DO NOTHING` returns no row at all). The
-- `where client_request_id is not null` predicate matches the partial
-- index above exactly, as Postgres requires for `ON CONFLICT` to target it.
-- When `p_client_request_id` is NULL (an old client — see Scenario F),
-- this predicate can never match, so the insert proceeds exactly as
-- before, unaffected.
-- =============================================================================
create or replace function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_transaction_date date default current_date,
  p_description text default null,
  p_notes text default null,
  p_client_request_id uuid default null
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

  insert into public.transactions (
    user_id, type, amount, currency_code, transaction_date,
    description, notes, from_account_id, to_account_id, source,
    client_request_id
  ) values (
    auth.uid(), 'transfer', p_amount, v_from_currency, p_transaction_date,
    p_description, p_notes, p_from_account_id, p_to_account_id, 'manual',
    p_client_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null
  do update set id = public.transactions.id
  returning * into v_row;

  return v_row;
end;
$$;
