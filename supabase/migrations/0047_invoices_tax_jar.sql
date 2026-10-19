-- =============================================================================
-- WEALTH OS — Migration 0047: Invoices (ออกใบแจ้งหนี้) + Tax jar (โหลภาษี)
--
-- Approved by the user 2026-10-19 18:57 (plan: invoice-taxjar-plan.md).
-- Staging first. No clients table in v1 (client_name is free text). No public
-- share link (no unauthenticated read path) — RLS is per-user only, exactly
-- like the existing per-user tables (e.g. merchant_account_preferences, 0042).
--
-- Money rules (approved):
--   * Income is recorded as the cash actually received (invoice net_amount).
--   * Withholding tax stays on the invoice as a tax credit, never as income cash.
--   * Tax-jar set-aside base = cash received. The jar is an earmark only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null check (char_length(btrim(invoice_number)) between 1 and 40),
  client_name text not null check (char_length(btrim(client_name)) between 1 and 120),
  client_is_company boolean not null default false,
  issue_date date not null default current_date,
  due_date date not null,
  -- 'overdue' is derived at read time (sent and today > due_date), never stored.
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  withholding_rate_pct numeric(4,2) not null default 0 check (withholding_rate_pct in (0, 1, 2, 3, 5)),
  subtotal_amount numeric(18,2) not null default 0 check (subtotal_amount >= 0),
  withholding_amount numeric(18,2) not null default 0 check (withholding_amount >= 0),
  net_amount numeric(18,2) not null default 0 check (net_amount >= 0),
  currency_code text not null default 'THB' check (char_length(currency_code) = 3),
  receive_account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  earn_project_id uuid references public.earn_projects(id) on delete set null,
  income_transaction_id uuid unique references public.transactions(id) on delete set null,
  sent_at timestamptz,
  paid_at date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_paid_shape_chk check (status <> 'paid' or paid_at is not null),
  constraint invoices_due_after_issue_chk check (due_date >= issue_date),
  constraint invoices_totals_chk check (net_amount = subtotal_amount - withholding_amount)
);

comment on table public.invoices is
  'Freelancer invoices. Totals are recomputed on the server (calculateInvoiceTotals) before every write. Marking paid creates one income transaction for net_amount (cash received); withholding_amount is kept as a tax credit.';

create unique index invoices_user_number_idx on public.invoices (user_id, invoice_number);
create index invoices_user_status_due_idx on public.invoices (user_id, status, due_date);
create index invoices_receive_account_idx on public.invoices (receive_account_id) where receive_account_id is not null;
create index invoices_category_idx on public.invoices (category_id) where category_id is not null;
create index invoices_earn_project_idx on public.invoices (earn_project_id) where earn_project_id is not null;

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) invoice_items
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position smallint not null default 0,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(18,2) not null check (unit_price >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);
create index invoice_items_user_idx on public.invoice_items (user_id);

-- ---------------------------------------------------------------------------
-- 3) tax jar
-- ---------------------------------------------------------------------------
create table public.tax_jar_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rate_pct numeric(4,1) not null default 7 check (rate_pct between 0 and 50),
  mode text not null default 'ask' check (mode in ('ask', 'auto')),
  account_id uuid references public.accounts(id) on delete set null,
  expense_408_rate_pct numeric(4,1) not null default 60 check (expense_408_rate_pct between 0 and 100),
  extra_deductions_amount numeric(18,2) not null default 0 check (extra_deductions_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tax_jar_settings is
  'One row per user: tax-jar set-aside % (default 7, mode ask) and estimate inputs (40(8) expense %, manual extra deductions). Earmark only; moves no money.';

create index tax_jar_settings_account_idx on public.tax_jar_settings (account_id) where account_id is not null;

create trigger set_tax_jar_settings_updated_at
  before update on public.tax_jar_settings
  for each row execute function public.set_updated_at();

create table public.tax_jar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_year smallint not null check (tax_year between 2020 and 2100),       -- Gregorian
  kind text not null check (kind in ('set_aside', 'withdraw', 'adjust')),
  amount numeric(18,2) not null check (amount > 0),                        -- sign comes from kind
  rate_pct numeric(4,1) check (rate_pct is null or rate_pct between 0 and 50),
  source_transaction_id uuid references public.transactions(id) on delete set null,
  income_type text check (income_type in ('40_2', '40_8')),
  entry_date date not null default current_date,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

comment on table public.tax_jar_entries is
  'Append-only tax-jar ledger. Balance per tax year = set_aside + adjust - withdraw. Corrections are new adjust/withdraw rows (no UPDATE policy).';

create unique index tax_jar_entries_one_per_income_idx
  on public.tax_jar_entries (source_transaction_id)
  where kind = 'set_aside' and source_transaction_id is not null;
create index tax_jar_entries_user_year_idx on public.tax_jar_entries (user_id, tax_year, entry_date desc);

-- ---------------------------------------------------------------------------
-- 4) allow invoice-originated income
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'seed', 'import', 'recurring', 'quick_text', 'voice', 'receipt', 'invoice'));

-- ---------------------------------------------------------------------------
-- 5) Ownership triggers (same pattern as 0013 / 0041 / 0042): a plain FK does
--    not check that the referenced row belongs to the same user.
-- ---------------------------------------------------------------------------
create or replace function public.check_invoice_refs_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.receive_account_id is not null and not exists (
    select 1 from public.accounts where id = new.receive_account_id and user_id = new.user_id
  ) then
    raise exception 'receive_account_id must reference an account owned by the same user';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories
    where id = new.category_id and (user_id is null or user_id = new.user_id)
  ) then
    raise exception 'category_id must reference a system category or one owned by the same user';
  end if;
  if new.earn_project_id is not null and not exists (
    select 1 from public.earn_projects where id = new.earn_project_id and user_id = new.user_id
  ) then
    raise exception 'earn_project_id must reference an earn project owned by the same user';
  end if;
  if new.income_transaction_id is not null and not exists (
    select 1 from public.transactions
    where id = new.income_transaction_id and user_id = new.user_id and type = 'income'
  ) then
    raise exception 'income_transaction_id must reference an income transaction owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_invoice_refs_ownership_trg
  before insert or update of user_id, receive_account_id, category_id, earn_project_id, income_transaction_id
  on public.invoices
  for each row execute function public.check_invoice_refs_ownership();

-- Undo of "ได้รับเงินแล้ว": deleting the income transaction nulls
-- income_transaction_id (FK on delete set null); return the invoice to 'sent'.
create or replace function public.invoice_unpaid_on_income_removed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.income_transaction_id is not null
     and new.income_transaction_id is null
     and new.status = 'paid' then
    new.status := 'sent';
    new.paid_at := null;
  end if;
  return new;
end;
$$;

create trigger invoice_unpaid_on_income_removed_trg
  before update of income_transaction_id on public.invoices
  for each row execute function public.invoice_unpaid_on_income_removed();

create or replace function public.check_invoice_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.invoices where id = new.invoice_id and user_id = new.user_id
  ) then
    raise exception 'invoice_id must reference an invoice owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_invoice_item_ownership_trg
  before insert or update of user_id, invoice_id on public.invoice_items
  for each row execute function public.check_invoice_item_ownership();

create or replace function public.check_tax_jar_refs_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'tax_jar_settings' then
    if new.account_id is not null and not exists (
      select 1 from public.accounts where id = new.account_id and user_id = new.user_id
    ) then
      raise exception 'account_id must reference an account owned by the same user';
    end if;
  elsif tg_table_name = 'tax_jar_entries' then
    if new.source_transaction_id is not null and not exists (
      select 1 from public.transactions
      where id = new.source_transaction_id and user_id = new.user_id and type = 'income'
    ) then
      raise exception 'source_transaction_id must reference an income transaction owned by the same user';
    end if;
  end if;
  return new;
end;
$$;

create trigger check_tax_jar_settings_ownership_trg
  before insert or update of user_id, account_id on public.tax_jar_settings
  for each row execute function public.check_tax_jar_refs_ownership();

create trigger check_tax_jar_entries_ownership_trg
  before insert or update of user_id, source_transaction_id on public.tax_jar_entries
  for each row execute function public.check_tax_jar_refs_ownership();

-- Internal trigger routines are not client RPCs (same as 0046).
revoke execute on function
  public.check_invoice_refs_ownership(),
  public.invoice_unpaid_on_income_removed(),
  public.check_invoice_item_ownership(),
  public.check_tax_jar_refs_ownership()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) RLS — per-user, mirrors existing tables. No anon/public read path.
-- ---------------------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.tax_jar_settings enable row level security;
alter table public.tax_jar_entries enable row level security;

create policy "invoices_select_own" on public.invoices
  for select using (user_id = auth.uid());
create policy "invoices_insert_own" on public.invoices
  for insert with check (user_id = auth.uid());
create policy "invoices_update_own" on public.invoices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoices_delete_own" on public.invoices
  for delete using (user_id = auth.uid());

create policy "invoice_items_select_own" on public.invoice_items
  for select using (user_id = auth.uid());
create policy "invoice_items_insert_own" on public.invoice_items
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
create policy "invoice_items_update_own" on public.invoice_items
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
create policy "invoice_items_delete_own" on public.invoice_items
  for delete using (user_id = auth.uid());

create policy "tax_jar_settings_select_own" on public.tax_jar_settings
  for select using (user_id = auth.uid());
create policy "tax_jar_settings_insert_own" on public.tax_jar_settings
  for insert with check (user_id = auth.uid());
create policy "tax_jar_settings_update_own" on public.tax_jar_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tax_jar_settings_delete_own" on public.tax_jar_settings
  for delete using (user_id = auth.uid());

-- Append-only ledger: no UPDATE policy (fix with an 'adjust' / 'withdraw' row).
create policy "tax_jar_entries_select_own" on public.tax_jar_entries
  for select using (user_id = auth.uid());
create policy "tax_jar_entries_insert_own" on public.tax_jar_entries
  for insert with check (user_id = auth.uid());
create policy "tax_jar_entries_delete_own" on public.tax_jar_entries
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) mark_invoice_paid — atomic, idempotent "ได้รับเงินแล้ว".
-- SECURITY INVOKER (default): every read/write goes through the caller's RLS.
-- Creates ONE income transaction for net_amount (cash received), marks the
-- invoice paid, and links Earn when the invoice has an earn project.
-- Calling again for an already-paid invoice returns the same transaction id.
-- ---------------------------------------------------------------------------
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_paid_date date,
  p_account_id uuid,
  p_allow_draft boolean default false
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inv public.invoices;
  v_account uuid;
  v_currency text;
  v_income_path uuid;
  v_tx public.transactions;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_inv from public.invoices
    where id = p_invoice_id and user_id = v_user
    for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;

  if v_inv.status = 'paid' and v_inv.income_transaction_id is not null then
    return v_inv.income_transaction_id;  -- idempotent retry
  end if;
  if v_inv.status = 'void' then
    raise exception 'invoice_void';
  end if;
  if v_inv.status = 'draft' and not coalesce(p_allow_draft, false) then
    raise exception 'invoice_not_sent';
  end if;
  if v_inv.net_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  v_account := coalesce(p_account_id, v_inv.receive_account_id);
  select currency_code into v_currency from public.accounts
    where id = v_account and user_id = v_user;
  if v_currency is null then
    raise exception 'account_not_found';
  end if;

  -- The invoice id doubles as the idempotency key, so a retry that races the
  -- status update can never create a second income row.
  insert into public.transactions (
    user_id, type, account_id, category_id, amount, currency_code,
    transaction_date, description, source, client_request_id
  ) values (
    v_user, 'income', v_account, v_inv.category_id, v_inv.net_amount, v_currency,
    coalesce(p_paid_date, current_date),
    left(v_inv.invoice_number || ' · ' || v_inv.client_name, 200),
    'invoice', v_inv.id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null
  do update set id = public.transactions.id
  returning * into v_tx;

  if v_tx.type <> 'income' or v_tx.source <> 'invoice' then
    raise exception 'client_request_id_conflict';
  end if;

  update public.invoices
    set status = 'paid',
        paid_at = coalesce(p_paid_date, current_date),
        income_transaction_id = v_tx.id,
        receive_account_id = coalesce(receive_account_id, v_account)
    where id = v_inv.id;

  if v_inv.earn_project_id is not null then
    select income_path_id into v_income_path from public.earn_projects
      where id = v_inv.earn_project_id and user_id = v_user;
    if v_income_path is not null then
      insert into public.earn_transaction_links (user_id, transaction_id, income_path_id, earn_project_id)
      values (v_user, v_tx.id, v_income_path, v_inv.earn_project_id)
      on conflict (transaction_id) do nothing;
    end if;
  end if;

  return v_tx.id;
end;
$$;

revoke all on function public.mark_invoice_paid(uuid, date, uuid, boolean) from public, anon;
grant execute on function public.mark_invoice_paid(uuid, date, uuid, boolean) to authenticated;
