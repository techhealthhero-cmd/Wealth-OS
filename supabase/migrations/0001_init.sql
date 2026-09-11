-- =============================================================================
-- WEALTH OS — Migration 0001: initial schema
--
-- Design decisions (documented per project convention — see README.md):
--
-- 1. Money is stored as NUMERIC(18,2), never FLOAT/DOUBLE PRECISION. Binary
--    floating point cannot represent most decimal fractions exactly (e.g.
--    0.1 + 0.2 !== 0.3), which silently corrupts financial totals over many
--    transactions. NUMERIC is an exact decimal type; (18,2) supports values
--    up to ~10^16 with 2 decimal places, far beyond any realistic personal
--    balance, while keeping storage/computation cheap.
--
-- 2. Enumerated fields (account_type, transaction type, category type, ...)
--    use TEXT + CHECK constraints rather than native Postgres ENUM types.
--    Native enums require `ALTER TYPE ... ADD VALUE` to extend and cannot be
--    easily reordered/removed; TEXT + CHECK is a plain `ALTER TABLE ... DROP
--    CONSTRAINT / ADD CONSTRAINT`, which is far easier to evolve safely as
--    the product grows (new account types, new transaction types, etc).
--
-- 3. Transfers are modeled as a SINGLE transaction row with `from_account_id`
--    and `to_account_id` (rather than two linked rows). This guarantees
--    transfer creation is atomic by construction (one INSERT), makes it
--    impossible to end up with a one-sided transfer, and keeps aggregation
--    queries simple: `type = 'transfer'` rows are always excluded from
--    income/expense totals, so a transfer between accounts can never be
--    miscounted as income or spending.
--
-- 4. `accounts.current_balance` is a maintained column, kept correct by a
--    trigger that *recomputes* the full balance from `opening_balance` plus
--    an aggregate over `transactions` on every relevant write (see
--    `recalc_account_balance`), rather than incrementing/decrementing it in
--    place. Recomputation is immune to drift (a missed increment can never
--    accumulate) at the cost of a cheap aggregate query per write, which is
--    an easy trade at Day-1 scale.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Shared helper: keep `updated_at` current on every UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles
-- =============================================================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'th'
    check (preferred_language in ('th', 'en')),
  currency_code text not null default 'THB'
    check (char_length(currency_code) = 3),
  timezone text not null default 'Asia/Bangkok',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth.users user. Created automatically by handle_new_user() trigger.';

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- accounts
-- =============================================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  account_type text not null check (
    account_type in ('cash', 'bank', 'savings', 'e_wallet', 'credit_card', 'investment', 'other')
  ),
  institution text,
  currency_code text not null default 'THB' check (char_length(currency_code) = 3),
  opening_balance numeric(18, 2) not null default 0,
  -- Always derived by trigger from opening_balance + transactions; never
  -- trust a client-supplied value (see set_account_current_balance below).
  current_balance numeric(18, 2) not null default 0,
  include_in_net_worth boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- Never trust a client-supplied current_balance: always derive it from
-- opening_balance at insert time (transactions trigger keeps it correct
-- afterwards).
create or replace function public.set_account_current_balance()
returns trigger
language plpgsql
as $$
begin
  new.current_balance := new.opening_balance;
  return new;
end;
$$;

create trigger set_accounts_initial_balance
  before insert on public.accounts
  for each row execute function public.set_account_current_balance();

-- =============================================================================
-- categories
-- =============================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  -- NULL user_id = system category, shared read-only across all users.
  user_id uuid references auth.users(id) on delete cascade,
  name_th text not null check (char_length(trim(name_th)) > 0),
  name_en text not null check (char_length(trim(name_en)) > 0),
  type text not null check (type in ('income', 'expense', 'both')),
  icon text,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);

-- A system category can never belong to a user, and vice versa.
alter table public.categories
  add constraint categories_system_ownership_chk
  check (
    (is_system = true and user_id is null)
    or (is_system = false and user_id is not null)
  );

-- =============================================================================
-- transactions
-- =============================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Populated for every type EXCEPT 'transfer'.
  account_id uuid references public.accounts(id) on delete restrict,
  -- Populated ONLY for type = 'transfer'.
  from_account_id uuid references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,

  category_id uuid references public.categories(id) on delete set null,

  type text not null check (
    type in (
      'income', 'expense', 'transfer', 'refund',
      'debt_payment', 'savings_transfer', 'investment_allocation'
    )
  ),
  amount numeric(18, 2) not null check (amount > 0),
  currency_code text not null default 'THB' check (char_length(currency_code) = 3),
  transaction_date date not null default current_date,
  description text,
  merchant text,
  notes text,
  is_recurring boolean not null default false,
  source text not null default 'manual'
    check (source in ('manual', 'seed', 'import', 'recurring')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Enforce the single-row transfer shape described at the top of this file:
  -- transfers use from/to and never a category; everything else uses
  -- account_id and never from/to.
  constraint transactions_account_shape_chk check (
    (
      type = 'transfer'
      and account_id is null
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id
      and category_id is null
    )
    or (
      type <> 'transfer'
      and account_id is not null
      and from_account_id is null
      and to_account_id is null
    )
  )
);

create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc);
create index transactions_user_type_idx on public.transactions (user_id, type);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_from_account_idx on public.transactions (from_account_id) where from_account_id is not null;
create index transactions_to_account_idx on public.transactions (to_account_id) where to_account_id is not null;

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- tags / transaction_tags
-- =============================================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create index transaction_tags_tag_id_idx on public.transaction_tags (tag_id);

-- =============================================================================
-- Account balance maintenance
-- =============================================================================

-- Recomputes accounts.current_balance from scratch for one account. See the
-- file header for why full recomputation (vs. incremental +/-) was chosen.
--
-- Per-type effect on the named account:
--   income, refund                                      -> credit (+)
--   expense, debt_payment, savings_transfer,
--     investment_allocation                              -> debit  (-)
--   transfer where this account is from_account_id        -> debit  (-)
--   transfer where this account is to_account_id           -> credit (+)
--
-- Limitation (documented, Day-1 scope): debt_payment / savings_transfer /
-- investment_allocation only debit the source account. They do not model a
-- corresponding credit to a liability/savings/investment account — that
-- requires a fuller double-entry ledger, deferred to a later phase.
create or replace function public.recalc_account_balance(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.accounts
  set current_balance = opening_balance + coalesce((
    select sum(
      case
        when t.type in ('income', 'refund') and t.account_id = p_account_id then t.amount
        when t.type in ('expense', 'debt_payment', 'savings_transfer', 'investment_allocation')
             and t.account_id = p_account_id then -t.amount
        when t.type = 'transfer' and t.from_account_id = p_account_id then -t.amount
        when t.type = 'transfer' and t.to_account_id = p_account_id then t.amount
        else 0
      end
    )
    from public.transactions t
    where t.account_id = p_account_id
       or t.from_account_id = p_account_id
       or t.to_account_id = p_account_id
  ), 0)
  where id = p_account_id;
end;
$$;

create or replace function public.trg_recalc_account_balances()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid[];
  acc uuid;
begin
  affected := array[]::uuid[];

  if tg_op in ('INSERT', 'UPDATE') then
    affected := affected || new.account_id || new.from_account_id || new.to_account_id;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    affected := affected || old.account_id || old.from_account_id || old.to_account_id;
  end if;

  foreach acc in array affected loop
    if acc is not null then
      perform public.recalc_account_balance(acc);
    end if;
  end loop;

  return null;
end;
$$;

create trigger recalc_account_balances_on_transaction_change
  after insert or update or delete on public.transactions
  for each row execute function public.trg_recalc_account_balances();

-- Keep current_balance correct if a user edits opening_balance later.
create or replace function public.trg_recalc_on_opening_balance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.opening_balance is distinct from old.opening_balance then
    perform public.recalc_account_balance(new.id);
  end if;
  return null;
end;
$$;

create trigger recalc_balance_on_opening_balance_change
  after update of opening_balance on public.accounts
  for each row execute function public.trg_recalc_on_opening_balance_change();

-- =============================================================================
-- Atomic transfer creation RPC
--
-- A single-row transfer INSERT is already atomic, but this RPC centralizes
-- validation (ownership, currency match, distinct accounts) into one tested
-- code path for the "create a transfer" server action, rather than
-- duplicating those checks in application code. SECURITY INVOKER (the
-- default) means it runs as the calling user, so RLS below still applies.
-- =============================================================================
create or replace function public.create_transfer(
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

  insert into public.transactions (
    user_id, type, amount, currency_code, transaction_date,
    description, notes, from_account_id, to_account_id, source
  ) values (
    auth.uid(), 'transfer', p_amount, v_from_currency, p_transaction_date,
    p_description, p_notes, p_from_account_id, p_to_account_id, 'manual'
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- =============================================================================
-- Profile bootstrap: create a profile row the moment a user signs up.
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;

-- profiles: a user may only see/edit their own profile row.
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles_delete_own" on public.profiles
  for delete using (user_id = auth.uid());

-- accounts: fully scoped to the owning user.
create policy "accounts_select_own" on public.accounts
  for select using (user_id = auth.uid());
create policy "accounts_insert_own" on public.accounts
  for insert with check (user_id = auth.uid());
create policy "accounts_update_own" on public.accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts_delete_own" on public.accounts
  for delete using (user_id = auth.uid());

-- categories: system categories are readable by any authenticated user;
-- custom categories are fully scoped to their owner.
create policy "categories_select_own_or_system" on public.categories
  for select using (is_system = true or user_id = auth.uid());
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid() and is_system = false);
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid() and is_system = false);

-- transactions: fully scoped to the owning user, AND every referenced
-- account/category must also belong to that user (or be a system category).
-- This is the DB-level backstop against a client submitting an
-- account_id/category_id it doesn't own — never trust the client for this.
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid());

create policy "transactions_insert_own" on public.transactions
  for insert with check (
    user_id = auth.uid()
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
    and (from_account_id is null or exists (
      select 1 from public.accounts a where a.id = from_account_id and a.user_id = auth.uid()
    ))
    and (to_account_id is null or exists (
      select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = category_id and (c.is_system = true or c.user_id = auth.uid())
    ))
  );

create policy "transactions_update_own" on public.transactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (
      select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
    ))
    and (from_account_id is null or exists (
      select 1 from public.accounts a where a.id = from_account_id and a.user_id = auth.uid()
    ))
    and (to_account_id is null or exists (
      select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from public.categories c
      where c.id = category_id and (c.is_system = true or c.user_id = auth.uid())
    ))
  );

create policy "transactions_delete_own" on public.transactions
  for delete using (user_id = auth.uid());

-- tags: fully scoped to the owning user.
create policy "tags_select_own" on public.tags
  for select using (user_id = auth.uid());
create policy "tags_insert_own" on public.tags
  for insert with check (user_id = auth.uid());
create policy "tags_update_own" on public.tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tags_delete_own" on public.tags
  for delete using (user_id = auth.uid());

-- transaction_tags: scoped via the parent transaction's ownership (this
-- join table has no user_id column of its own).
create policy "transaction_tags_select_own" on public.transaction_tags
  for select using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );
create policy "transaction_tags_insert_own" on public.transaction_tags
  for insert with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.tags tg
      where tg.id = tag_id and tg.user_id = auth.uid()
    )
  );
create policy "transaction_tags_delete_own" on public.transaction_tags
  for delete using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );
