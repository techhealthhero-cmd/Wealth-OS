-- =============================================================================
-- WEALTH OS — Migration 0003: Day 2 Wealth Engine
--
-- Adds: budgets, budget_categories, assets, liabilities, net_worth_snapshots,
-- financial_goals, emergency_funds, wealth_scores.
--
-- Conventions carried over from 0001_init.sql (see that file's header for the
-- full rationale): UUID PKs via gen_random_uuid(), NUMERIC(18,2) for all
-- money (never float), TEXT + CHECK instead of native enums, user_id
-- ownership + RLS on every table, updated_at maintained by the existing
-- public.set_updated_at() trigger function.
--
-- Double-counting rule (Assets/Net Worth — see CLAUDE.md "NET WORTH" and the
-- Day 2 task spec): an `accounts` row already contributes its own balance to
-- Net Worth when `accounts.include_in_net_worth = true` (existing column,
-- migration 0001). A manual `assets` row is for wealth NOT already
-- represented by an account (property, vehicle, gold, a business stake,
-- ...). `assets.linked_account_id` exists only to let the UI show "this
-- asset corresponds to that account" for the user's own bookkeeping — the
-- application layer (`calculateNetWorth()`) must exclude any asset row that
-- has a non-null `linked_account_id` from the assets total, since the linked
-- account is already counted. This is enforced in application code
-- (`src/lib/financial/net-worth.ts`), not in SQL, because "is this
-- double-counted" is a Net-Worth-calculation-time concern, not a data
-- integrity concern the database can check at write time.
-- =============================================================================

-- =============================================================================
-- budgets — one row per user per calendar month.
-- =============================================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Always the 1st of the month — normalizes "which month is this" to a
  -- single comparable value instead of a separate (year, month) pair.
  month date not null,
  total_budget numeric(18, 2) not null default 0 check (total_budget >= 0),
  planned_savings numeric(18, 2) not null default 0 check (planned_savings >= 0),
  planned_investment numeric(18, 2) not null default 0 check (planned_investment >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budgets_month_is_first_of_month check (month = date_trunc('month', month)::date),
  -- Prevents duplicate/conflicting budget records for the same month.
  unique (user_id, month)
);

create index budgets_user_id_idx on public.budgets (user_id);

create trigger set_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- budget_categories — per-category allocation within a budget.
-- =============================================================================
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  amount numeric(18, 2) not null default 0 check (amount >= 0),
  is_fixed boolean not null default false,
  is_essential boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (budget_id, category_id)
);

create index budget_categories_budget_id_idx on public.budget_categories (budget_id);
create index budget_categories_category_id_idx on public.budget_categories (category_id);

create trigger set_budget_categories_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();

-- =============================================================================
-- assets — manual (non-account) assets: property, vehicle, gold, crypto, ...
-- =============================================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  asset_type text not null check (
    asset_type in (
      'cash', 'bank', 'savings', 'investment', 'gold', 'crypto',
      'property', 'vehicle', 'business', 'other'
    )
  ),
  value numeric(18, 2) not null default 0 check (value >= 0),
  currency_code text not null default 'THB' check (char_length(currency_code) = 3),
  include_in_net_worth boolean not null default true,
  -- Optional bookkeeping link only — see the file header's double-counting
  -- rule. Application code, not a DB constraint, excludes linked assets from
  -- the Net Worth assets total.
  linked_account_id uuid references public.accounts(id) on delete set null,
  notes text,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets (user_id);
create index assets_linked_account_idx on public.assets (linked_account_id) where linked_account_id is not null;

create trigger set_assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- liabilities — credit cards, loans, mortgages, informal debt, ...
-- =============================================================================
create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  liability_type text not null check (
    liability_type in (
      'credit_card', 'personal_loan', 'car_loan', 'mortgage',
      'student_loan', 'informal_debt', 'other'
    )
  ),
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  interest_rate numeric(6, 3) check (interest_rate is null or interest_rate >= 0),
  minimum_payment numeric(18, 2) check (minimum_payment is null or minimum_payment >= 0),
  due_date date,
  include_in_net_worth boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index liabilities_user_id_idx on public.liabilities (user_id);

create trigger set_liabilities_updated_at
  before update on public.liabilities
  for each row execute function public.set_updated_at();

-- =============================================================================
-- net_worth_snapshots — periodic point-in-time Net Worth records.
-- =============================================================================
create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  total_assets numeric(18, 2) not null default 0,
  total_liabilities numeric(18, 2) not null default 0,
  net_worth numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),

  -- At most one snapshot per user per day — re-snapshotting the same day
  -- updates (upserts) rather than accumulating duplicates.
  unique (user_id, snapshot_date)
);

create index net_worth_snapshots_user_date_idx on public.net_worth_snapshots (user_id, snapshot_date desc);

-- =============================================================================
-- financial_goals
-- =============================================================================
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  goal_type text not null check (
    goal_type in (
      'emergency_fund', 'travel', 'gadget', 'car', 'home', 'education',
      'wedding', 'business_capital', 'million', 'retirement', 'custom'
    )
  ),
  target_amount numeric(18, 2) not null check (target_amount > 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  monthly_contribution numeric(18, 2) not null default 0 check (monthly_contribution >= 0),
  linked_account_id uuid references public.accounts(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index financial_goals_user_id_idx on public.financial_goals (user_id);
create index financial_goals_linked_account_idx on public.financial_goals (linked_account_id) where linked_account_id is not null;

create trigger set_financial_goals_updated_at
  before update on public.financial_goals
  for each row execute function public.set_updated_at();

-- =============================================================================
-- emergency_funds — one tracker per user.
-- =============================================================================
create table public.emergency_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  -- Target expressed as a multiple of essential monthly expenses (3/6/9/12
  -- or any custom value), OR as a flat custom_target_amount — at least one
  -- must be set. Essential monthly expenses themselves are computed live
  -- from budget_categories/transactions (see src/lib/financial/emergency-fund.ts),
  -- not stored here, to avoid a second source of truth that can go stale.
  target_months numeric(4, 1) check (target_months is null or target_months > 0),
  custom_target_amount numeric(18, 2) check (custom_target_amount is null or custom_target_amount > 0),
  current_amount numeric(18, 2) not null default 0 check (current_amount >= 0),
  monthly_contribution numeric(18, 2) not null default 0 check (monthly_contribution >= 0),
  linked_account_id uuid references public.accounts(id) on delete set null,
  linked_goal_id uuid references public.financial_goals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint emergency_funds_has_a_target check (target_months is not null or custom_target_amount is not null)
);

create index emergency_funds_linked_account_idx on public.emergency_funds (linked_account_id) where linked_account_id is not null;
create index emergency_funds_linked_goal_idx on public.emergency_funds (linked_goal_id) where linked_goal_id is not null;

create trigger set_emergency_funds_updated_at
  before update on public.emergency_funds
  for each row execute function public.set_updated_at();

-- =============================================================================
-- wealth_scores — append-only history; the latest row per user is "current".
-- =============================================================================
create table public.wealth_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  total_score numeric(5, 2) not null check (total_score >= 0 and total_score <= 100),
  cash_flow_score numeric(5, 2) not null check (cash_flow_score >= 0 and cash_flow_score <= 100),
  savings_score numeric(5, 2) not null check (savings_score >= 0 and savings_score <= 100),
  emergency_fund_score numeric(5, 2) not null check (emergency_fund_score >= 0 and emergency_fund_score <= 100),
  debt_health_score numeric(5, 2) not null check (debt_health_score >= 0 and debt_health_score <= 100),
  net_worth_growth_score numeric(5, 2) not null check (net_worth_growth_score >= 0 and net_worth_growth_score <= 100),
  income_growth_score numeric(5, 2) not null check (income_growth_score >= 0 and income_growth_score <= 100),
  goal_progress_score numeric(5, 2) not null check (goal_progress_score >= 0 and goal_progress_score <= 100),
  calculation_version integer not null default 1,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index wealth_scores_user_calculated_idx on public.wealth_scores (user_id, calculated_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.assets enable row level security;
alter table public.liabilities enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.financial_goals enable row level security;
alter table public.emergency_funds enable row level security;
alter table public.wealth_scores enable row level security;

-- budgets: fully scoped to the owning user.
create policy "budgets_select_own" on public.budgets
  for select using (user_id = auth.uid());
create policy "budgets_insert_own" on public.budgets
  for insert with check (user_id = auth.uid());
create policy "budgets_update_own" on public.budgets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets_delete_own" on public.budgets
  for delete using (user_id = auth.uid());

-- budget_categories: no user_id column of its own — scoped via the parent
-- budget's ownership (same join-table pattern as transaction_tags in 0001),
-- plus the referenced category must be visible to this user.
create policy "budget_categories_select_own" on public.budget_categories
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );
create policy "budget_categories_insert_own" on public.budget_categories
  for insert with check (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and (c.is_system = true or c.user_id = auth.uid())
    )
  );
create policy "budget_categories_update_own" on public.budget_categories
  for update using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and (c.is_system = true or c.user_id = auth.uid())
    )
  );
create policy "budget_categories_delete_own" on public.budget_categories
  for delete using (
    exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = auth.uid())
  );

-- assets: fully scoped to the owning user; a linked account must also be theirs.
create policy "assets_select_own" on public.assets
  for select using (user_id = auth.uid());
create policy "assets_insert_own" on public.assets
  for insert with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
  );
create policy "assets_update_own" on public.assets
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
  );
create policy "assets_delete_own" on public.assets
  for delete using (user_id = auth.uid());

-- liabilities: fully scoped to the owning user.
create policy "liabilities_select_own" on public.liabilities
  for select using (user_id = auth.uid());
create policy "liabilities_insert_own" on public.liabilities
  for insert with check (user_id = auth.uid());
create policy "liabilities_update_own" on public.liabilities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "liabilities_delete_own" on public.liabilities
  for delete using (user_id = auth.uid());

-- net_worth_snapshots: fully scoped to the owning user.
create policy "net_worth_snapshots_select_own" on public.net_worth_snapshots
  for select using (user_id = auth.uid());
create policy "net_worth_snapshots_insert_own" on public.net_worth_snapshots
  for insert with check (user_id = auth.uid());
create policy "net_worth_snapshots_update_own" on public.net_worth_snapshots
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "net_worth_snapshots_delete_own" on public.net_worth_snapshots
  for delete using (user_id = auth.uid());

-- financial_goals: fully scoped to the owning user; a linked account must also be theirs.
create policy "financial_goals_select_own" on public.financial_goals
  for select using (user_id = auth.uid());
create policy "financial_goals_insert_own" on public.financial_goals
  for insert with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
  );
create policy "financial_goals_update_own" on public.financial_goals
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
  );
create policy "financial_goals_delete_own" on public.financial_goals
  for delete using (user_id = auth.uid());

-- emergency_funds: fully scoped to the owning user; linked account/goal must also be theirs.
create policy "emergency_funds_select_own" on public.emergency_funds
  for select using (user_id = auth.uid());
create policy "emergency_funds_insert_own" on public.emergency_funds
  for insert with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
    and (linked_goal_id is null or exists (
      select 1 from public.financial_goals g where g.id = linked_goal_id and g.user_id = auth.uid()
    ))
  );
create policy "emergency_funds_update_own" on public.emergency_funds
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (linked_account_id is null or exists (
      select 1 from public.accounts a where a.id = linked_account_id and a.user_id = auth.uid()
    ))
    and (linked_goal_id is null or exists (
      select 1 from public.financial_goals g where g.id = linked_goal_id and g.user_id = auth.uid()
    ))
  );
create policy "emergency_funds_delete_own" on public.emergency_funds
  for delete using (user_id = auth.uid());

-- wealth_scores: fully scoped to the owning user. Written by the server
-- (recalculation), never by a client-trusted arbitrary insert of someone
-- else's user_id — enforced the same way as every other table here.
create policy "wealth_scores_select_own" on public.wealth_scores
  for select using (user_id = auth.uid());
create policy "wealth_scores_insert_own" on public.wealth_scores
  for insert with check (user_id = auth.uid());
create policy "wealth_scores_delete_own" on public.wealth_scores
  for delete using (user_id = auth.uid());
