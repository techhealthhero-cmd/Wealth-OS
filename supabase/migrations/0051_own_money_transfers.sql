-- =============================================================================
-- WEALTH OS — Migration 0051: Own-money transfers (wallet top-up / self-transfer)
--
-- A slip that moves the user's own money (bank → e-wallet, or one of their
-- accounts → another) must not be an expense. Counting it as spending
-- double-counts once the wallet or the destination account is spent.
--
-- transactions.to_account_id already exists (0001) for a two-account
-- transfer: that row debits from_account_id and credits to_account_id, and
-- calculateExpenses / calculateIncome already ignore type = 'transfer'.
-- This migration does not add that column.
--
-- What it adds:
--   1. categories.type may be 'transfer'. One system category,
--      โอนตัวเอง/เติมกระเป๋า, shown in the expense pickers.
--   2. A categorized one-account transfer: type = 'transfer' with account_id
--      and category_id set, and no from/to. Used when the destination isn't
--      an account we know (a wallet top-up, or a self-transfer before the
--      other account is saved). It does not change current_balance — the
--      money is still the user's, and the later spend is the expense.
--      recalc_account_balance already treats that shape as 0.
--   3. slip_inbox remembers both sides of the slip (names, banks, the
--      receiver mask, and the matched to_account_id) so confirm can post a
--      real from → to transfer.
--   4. accounts.account_number_mask — the printed mask, for an account saved
--      from a slip before the full number is known ("บันทึกบัญชีนี้").
--
-- Staging only until the owner applies it. Do not run against production.
-- =============================================================================

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'categories'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type in%'
  loop
    execute format('alter table public.categories drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.categories
  add constraint categories_type_check
  check (type in ('income', 'expense', 'both', 'transfer'));

insert into public.categories (name_th, name_en, type, icon, is_system, sort_order)
select 'โอนตัวเอง/เติมกระเป๋า', 'Own transfer', 'transfer', 'wallet-topup', true, 118
where not exists (
  select 1 from public.categories c
  where c.is_system and c.user_id is null and c.name_en = 'Own transfer' and c.type = 'transfer'
);

-- A one-account own-money row (no from/to) sits beside the existing
-- two-account transfer. Every row that already exists still satisfies one
-- of the first two branches.
alter table public.transactions drop constraint if exists transactions_account_shape_chk;
alter table public.transactions
  add constraint transactions_account_shape_chk check (
    (
      type = 'transfer'
      and account_id is null
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id
      and category_id is null
    )
    or (
      type = 'transfer'
      and account_id is not null
      and from_account_id is null
      and to_account_id is null
      and category_id is not null
    )
    or (
      type <> 'transfer'
      and account_id is not null
      and from_account_id is null
      and to_account_id is null
    )
  );

alter table public.accounts
  add column if not exists account_number_mask text
  check (account_number_mask is null or account_number_mask ~ '^[0-9x]{3,20}$');

comment on column public.accounts.account_number_mask is
  'The masked account number as printed on a slip ("xxxxx8710x"), kept when the full number is not known yet.';

alter table public.slip_inbox
  add column if not exists sender_name text check (sender_name is null or char_length(sender_name) <= 120),
  add column if not exists sender_bank text check (sender_bank is null or char_length(sender_bank) <= 80),
  add column if not exists receiver_account text check (receiver_account is null or receiver_account ~ '^[0-9x]{3,20}$'),
  add column if not exists receiver_bank text check (receiver_bank is null or char_length(receiver_bank) <= 80),
  add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

comment on column public.slip_inbox.receiver_account is
  'Recipient account as printed, separators removed, masked digits as x.';
comment on column public.slip_inbox.to_account_id is
  'The user account the money moved into, when the receiver mask matched. Confirm posts a transfer from account_id to this account.';

create or replace function public.check_slip_inbox_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and user_id = new.user_id
  ) then
    raise exception 'account_id must reference an account owned by the same user';
  end if;
  if new.to_account_id is not null and not exists (
    select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id
  ) then
    raise exception 'to_account_id must reference an account owned by the same user';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and (c.is_system = true or c.user_id = new.user_id)
  ) then
    raise exception 'category_id must be a system category or one owned by the same user';
  end if;
  if new.transaction_id is not null and not exists (
    select 1 from public.transactions where id = new.transaction_id and user_id = new.user_id
  ) then
    raise exception 'transaction_id must reference a transaction owned by the same user';
  end if;
  if new.possible_duplicate_of is not null and not exists (
    select 1 from public.transactions where id = new.possible_duplicate_of and user_id = new.user_id
  ) then
    raise exception 'possible_duplicate_of must reference a transaction owned by the same user';
  end if;
  if new.token_id is not null and not exists (
    select 1 from public.capture_tokens where id = new.token_id and user_id = new.user_id
  ) then
    raise exception 'token_id must reference a capture token owned by the same user';
  end if;
  return new;
end;
$$;

drop trigger if exists check_slip_inbox_ownership_trg on public.slip_inbox;
create trigger check_slip_inbox_ownership_trg
  before insert or update of user_id, account_id, to_account_id, category_id, transaction_id, possible_duplicate_of, token_id
  on public.slip_inbox
  for each row execute function public.check_slip_inbox_ownership();
