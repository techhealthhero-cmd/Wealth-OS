-- =============================================================================
-- WEALTH OS — Migration 0031: Earn V2 projects + real-income links
--
-- Additive only; nothing existing is altered or backfilled.
--
-- Money rule (CLAUDE.md, migration 0028): public.transactions stays the ONLY
-- source of truth for actual money. Earn never stores amounts of its own —
-- it only LINKS an existing income transaction to the income path (and
-- optionally the project) it came from. Historical transactions are never
-- auto-linked; a link exists only when the user records income from Earn.
--
-- record_earn_income() creates the income transaction and its link in one
-- function call (one database transaction: both rows or neither), with the
-- same client_request_id idempotency as transactions/create_transfer (0012):
-- a retried submit returns the already-created transaction, never a second
-- one, and the link insert is a no-op the second time.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- earn_projects — a real piece of economic activity inside a path
-- ("ABC Restaurant website", "Apply for Product Designer jobs").
-- ---------------------------------------------------------------------------
create table public.earn_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  income_path_id uuid not null references public.income_paths(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index earn_projects_user_path_idx on public.earn_projects (user_id, income_path_id, status);

create trigger set_earn_projects_updated_at
  before update on public.earn_projects
  for each row execute function public.set_updated_at();

alter table public.earn_projects enable row level security;

create policy "earn_projects_select_own" on public.earn_projects
  for select using (user_id = auth.uid());
create policy "earn_projects_insert_own" on public.earn_projects
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.income_paths p where p.id = income_path_id and p.user_id = auth.uid())
  );
create policy "earn_projects_update_own" on public.earn_projects
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.income_paths p where p.id = income_path_id and p.user_id = auth.uid())
  );
create policy "earn_projects_delete_own" on public.earn_projects
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- earn_transaction_links — which income transaction came from which path.
-- One transaction links to at most one path (unique), so Earn totals can
-- never double-count a baht. Links are immutable (no update policy).
-- ---------------------------------------------------------------------------
create table public.earn_transaction_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  income_path_id uuid not null references public.income_paths(id) on delete cascade,
  earn_project_id uuid references public.earn_projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create index earn_transaction_links_user_path_idx on public.earn_transaction_links (user_id, income_path_id);
create index earn_transaction_links_project_idx on public.earn_transaction_links (earn_project_id)
  where earn_project_id is not null;

alter table public.earn_transaction_links enable row level security;

create policy "earn_transaction_links_select_own" on public.earn_transaction_links
  for select using (user_id = auth.uid());
-- Every parent must belong to the same user, and only INCOME transactions
-- may be linked (a plain FK is not an ownership check — see 0013).
create policy "earn_transaction_links_insert_own" on public.earn_transaction_links
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid() and t.type = 'income'
    )
    and exists (select 1 from public.income_paths p where p.id = income_path_id and p.user_id = auth.uid())
    and (earn_project_id is null or exists (
      select 1 from public.earn_projects pr
      where pr.id = earn_project_id and pr.user_id = auth.uid() and pr.income_path_id = income_path_id
    ))
  );
create policy "earn_transaction_links_delete_own" on public.earn_transaction_links
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- record_earn_income — atomic, idempotent "I got paid from this path".
-- SECURITY INVOKER (default): every insert still goes through the caller's
-- own RLS (account/category ownership on transactions, parents on links).
-- ---------------------------------------------------------------------------
create or replace function public.record_earn_income(
  p_income_path_id uuid,
  p_earn_project_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_transaction_date date,
  p_description text,
  p_client_request_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_currency text;
  v_tx public.transactions;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_client_request_id is null then
    raise exception 'client_request_id_required';
  end if;

  perform 1 from public.income_paths where id = p_income_path_id and user_id = v_user;
  if not found then
    raise exception 'income_path_not_found';
  end if;

  if p_earn_project_id is not null then
    perform 1 from public.earn_projects
      where id = p_earn_project_id and user_id = v_user and income_path_id = p_income_path_id;
    if not found then
      raise exception 'earn_project_not_found';
    end if;
  end if;

  select currency_code into v_currency from public.accounts where id = p_account_id and user_id = v_user;
  if v_currency is null then
    raise exception 'account_not_found';
  end if;

  insert into public.transactions (
    user_id, type, account_id, category_id, amount, currency_code,
    transaction_date, description, source, client_request_id
  ) values (
    v_user, 'income', p_account_id, p_category_id, p_amount, v_currency,
    coalesce(p_transaction_date, current_date), p_description, 'manual', p_client_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null
  do update set id = public.transactions.id
  returning * into v_tx;

  -- A key reused for something that isn't this Earn income must not be
  -- silently re-labelled.
  if v_tx.type <> 'income' then
    raise exception 'client_request_id_conflict';
  end if;

  insert into public.earn_transaction_links (user_id, transaction_id, income_path_id, earn_project_id)
  values (v_user, v_tx.id, p_income_path_id, p_earn_project_id)
  on conflict (transaction_id) do nothing;

  return v_tx.id;
end;
$$;

revoke all on function public.record_earn_income(uuid, uuid, uuid, uuid, numeric, date, text, uuid) from public;
grant execute on function public.record_earn_income(uuid, uuid, uuid, uuid, numeric, date, text, uuid) to authenticated;
