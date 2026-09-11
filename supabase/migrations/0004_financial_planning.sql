-- =============================================================================
-- WEALTH OS — Migration 0004: Day 3 Financial Planning
--
-- Adds: money_years, quarterly_plans, money_year_major_expenses, debt_plans,
-- debt_plan_priorities, forecast_scenarios. Extends budgets with monthly-plan
-- columns (expected_income, debt_reduction_target, goal_contribution_target,
-- quarterly_plan_id) instead of creating a parallel "monthly_plans" table —
-- the existing budgets table (0003_wealth_engine.sql) already IS the
-- monthly plan (one row per user per month, total_budget/planned_savings/
-- planned_investment); duplicating it would violate the task's explicit
-- "never duplicate financial truth in multiple systems" rule.
--
-- Deliberately NOT created (avoiding unnecessary duplication):
--   - "monthly_plans" table — see above, budgets already serves this role.
--   - "forecast_assumptions" table — a forecast scenario has exactly one
--     assumption set (1:1), so it's columns on forecast_scenarios, not a
--     separate joined table.
--   - "forecast_snapshots" table — forecasts are deterministic projections
--     from current live data + explicit assumptions; recomputing on every
--     view is cheap and can never go stale, unlike a persisted snapshot.
--   - Financial Life Stage and the Priority Engine have NO table at all —
--     both are computed live from existing Day 1/2 data (transactions,
--     liabilities, emergency_funds, goals, wealth_scores), the same way
--     Wealth Score's components are. Nothing new to persist.
--
-- Conventions carried over from 0001/0003 (see those files for full
-- rationale): UUID PKs via gen_random_uuid(), NUMERIC(18,2) for money,
-- TEXT+CHECK instead of native enums, user_id ownership + RLS on every
-- table, updated_at via the existing set_updated_at() trigger.
-- =============================================================================

-- =============================================================================
-- money_years — one annual plan per user per year.
-- =============================================================================
create table public.money_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  annual_income_target numeric(18, 2) not null default 0 check (annual_income_target >= 0),
  annual_savings_target numeric(18, 2) not null default 0 check (annual_savings_target >= 0),
  annual_investment_target numeric(18, 2) not null default 0 check (annual_investment_target >= 0),
  annual_debt_reduction_target numeric(18, 2) not null default 0 check (annual_debt_reduction_target >= 0),
  annual_emergency_fund_target numeric(18, 2) not null default 0 check (annual_emergency_fund_target >= 0),
  expected_irregular_income numeric(18, 2) not null default 0 check (expected_irregular_income >= 0),
  expected_irregular_expenses numeric(18, 2) not null default 0 check (expected_irregular_expenses >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One plan per user per calendar year — prevents duplicate/conflicting
  -- annual plans the same way budgets prevents duplicate monthly ones.
  unique (user_id, year)
);

create index money_years_user_id_idx on public.money_years (user_id);

create trigger set_money_years_updated_at
  before update on public.money_years
  for each row execute function public.set_updated_at();

-- =============================================================================
-- quarterly_plans — breaks a money_year's annual targets into 4 quarters.
-- =============================================================================
create table public.quarterly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  money_year_id uuid not null references public.money_years(id) on delete cascade,
  quarter integer not null check (quarter between 1 and 4),
  income_target numeric(18, 2) not null default 0 check (income_target >= 0),
  savings_target numeric(18, 2) not null default 0 check (savings_target >= 0),
  investment_target numeric(18, 2) not null default 0 check (investment_target >= 0),
  debt_reduction_target numeric(18, 2) not null default 0 check (debt_reduction_target >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (money_year_id, quarter)
);

create index quarterly_plans_user_id_idx on public.quarterly_plans (user_id);
create index quarterly_plans_money_year_idx on public.quarterly_plans (money_year_id);

create trigger set_quarterly_plans_updated_at
  before update on public.quarterly_plans
  for each row execute function public.set_updated_at();

-- =============================================================================
-- money_year_major_expenses — planned big-ticket expenses for a year, each
-- optionally slotted into a specific month. This is intentionally distinct
-- from `financial_goals` (a goal is a savings target working toward a future
-- purchase; a major expense here is a planned one-time spend already
-- accounted for in the year's plan) and from `budgets`/`budget_categories`
-- (routine monthly spending, not one-off events).
-- =============================================================================
create table public.money_year_major_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  money_year_id uuid not null references public.money_years(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  amount numeric(18, 2) not null check (amount > 0),
  planned_month date,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index money_year_major_expenses_year_idx on public.money_year_major_expenses (money_year_id);

create trigger set_money_year_major_expenses_updated_at
  before update on public.money_year_major_expenses
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Extend budgets to double as the Monthly Plan (see file header).
-- =============================================================================
alter table public.budgets
  add column expected_income numeric(18, 2) not null default 0 check (expected_income >= 0),
  add column debt_reduction_target numeric(18, 2) not null default 0 check (debt_reduction_target >= 0),
  add column goal_contribution_target numeric(18, 2) not null default 0 check (goal_contribution_target >= 0),
  add column quarterly_plan_id uuid references public.quarterly_plans(id) on delete set null;

create index budgets_quarterly_plan_idx on public.budgets (quarterly_plan_id) where quarterly_plan_id is not null;

-- Re-create budgets' insert/update policies to also verify quarterly_plan_id
-- ownership when set — same "never trust a client-supplied foreign key"
-- backstop as every other cross-table reference in this app.
drop policy "budgets_insert_own" on public.budgets;
drop policy "budgets_update_own" on public.budgets;

create policy "budgets_insert_own" on public.budgets
  for insert with check (
    user_id = auth.uid()
    and (quarterly_plan_id is null or exists (
      select 1 from public.quarterly_plans qp where qp.id = quarterly_plan_id and qp.user_id = auth.uid()
    ))
  );
create policy "budgets_update_own" on public.budgets
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (quarterly_plan_id is null or exists (
      select 1 from public.quarterly_plans qp where qp.id = quarterly_plan_id and qp.user_id = auth.uid()
    ))
  );

-- =============================================================================
-- debt_plans — one active payoff strategy per user, applied across all of
-- their existing `liabilities` rows (0003_wealth_engine.sql). Does not copy
-- liability data — always reads balance/interest_rate/minimum_payment live.
-- =============================================================================
create table public.debt_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  strategy text not null default 'avalanche' check (strategy in ('snowball', 'avalanche', 'custom')),
  extra_monthly_payment numeric(18, 2) not null default 0 check (extra_monthly_payment >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_debt_plans_updated_at
  before update on public.debt_plans
  for each row execute function public.set_updated_at();

-- =============================================================================
-- debt_plan_priorities — explicit payoff order, used only when strategy =
-- 'custom' (snowball/avalanche compute their order deterministically from
-- balance/interest_rate at read time — no need to store it).
-- =============================================================================
create table public.debt_plan_priorities (
  id uuid primary key default gen_random_uuid(),
  debt_plan_id uuid not null references public.debt_plans(id) on delete cascade,
  liability_id uuid not null references public.liabilities(id) on delete cascade,
  priority_order integer not null check (priority_order > 0),
  created_at timestamptz not null default now(),

  unique (debt_plan_id, liability_id),
  unique (debt_plan_id, priority_order)
);

create index debt_plan_priorities_plan_idx on public.debt_plan_priorities (debt_plan_id);

-- =============================================================================
-- forecast_scenarios — a named, explicit assumption set (Base/Conservative/
-- Optimistic/Custom). Results are always computed live from these
-- assumptions plus current account/transaction/liability data — never
-- stored, so a forecast can never go stale relative to real data.
-- =============================================================================
create table public.forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  scenario_type text not null default 'custom' check (scenario_type in ('base', 'conservative', 'optimistic', 'custom')),
  horizon_months integer not null default 12 check (horizon_months > 0 and horizon_months <= 120),
  -- Percent per month, e.g. 0.5 = +0.5%/month. Stored as numeric, not a
  -- fraction, so the UI can show "0.5%" directly without a x100 step.
  income_growth_rate numeric(6, 3) not null default 0,
  expense_growth_rate numeric(6, 3) not null default 0,
  monthly_savings numeric(18, 2) not null default 0,
  monthly_investment numeric(18, 2) not null default 0,
  monthly_debt_payment numeric(18, 2) not null default 0,
  one_time_income numeric(18, 2) not null default 0,
  one_time_income_month date,
  one_time_expense numeric(18, 2) not null default 0,
  one_time_expense_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index forecast_scenarios_user_id_idx on public.forecast_scenarios (user_id);

create trigger set_forecast_scenarios_updated_at
  before update on public.forecast_scenarios
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.money_years enable row level security;
alter table public.quarterly_plans enable row level security;
alter table public.money_year_major_expenses enable row level security;
alter table public.debt_plans enable row level security;
alter table public.debt_plan_priorities enable row level security;
alter table public.forecast_scenarios enable row level security;

-- money_years: fully scoped to the owning user.
create policy "money_years_select_own" on public.money_years
  for select using (user_id = auth.uid());
create policy "money_years_insert_own" on public.money_years
  for insert with check (user_id = auth.uid());
create policy "money_years_update_own" on public.money_years
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "money_years_delete_own" on public.money_years
  for delete using (user_id = auth.uid());

-- quarterly_plans: fully scoped, and the parent money_year must be the user's own.
create policy "quarterly_plans_select_own" on public.quarterly_plans
  for select using (user_id = auth.uid());
create policy "quarterly_plans_insert_own" on public.quarterly_plans
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.money_years my where my.id = money_year_id and my.user_id = auth.uid())
  );
create policy "quarterly_plans_update_own" on public.quarterly_plans
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.money_years my where my.id = money_year_id and my.user_id = auth.uid())
  );
create policy "quarterly_plans_delete_own" on public.quarterly_plans
  for delete using (user_id = auth.uid());

-- money_year_major_expenses: fully scoped, and the parent money_year must be the user's own.
create policy "money_year_major_expenses_select_own" on public.money_year_major_expenses
  for select using (user_id = auth.uid());
create policy "money_year_major_expenses_insert_own" on public.money_year_major_expenses
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.money_years my where my.id = money_year_id and my.user_id = auth.uid())
  );
create policy "money_year_major_expenses_update_own" on public.money_year_major_expenses
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.money_years my where my.id = money_year_id and my.user_id = auth.uid())
  );
create policy "money_year_major_expenses_delete_own" on public.money_year_major_expenses
  for delete using (user_id = auth.uid());

-- debt_plans: fully scoped to the owning user.
create policy "debt_plans_select_own" on public.debt_plans
  for select using (user_id = auth.uid());
create policy "debt_plans_insert_own" on public.debt_plans
  for insert with check (user_id = auth.uid());
create policy "debt_plans_update_own" on public.debt_plans
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "debt_plans_delete_own" on public.debt_plans
  for delete using (user_id = auth.uid());

-- debt_plan_priorities: no user_id column of its own — scoped via the parent
-- debt_plan's ownership, and the referenced liability must also be the
-- user's own (same double-ownership-check pattern as budget_categories).
create policy "debt_plan_priorities_select_own" on public.debt_plan_priorities
  for select using (
    exists (select 1 from public.debt_plans dp where dp.id = debt_plan_id and dp.user_id = auth.uid())
  );
create policy "debt_plan_priorities_insert_own" on public.debt_plan_priorities
  for insert with check (
    exists (select 1 from public.debt_plans dp where dp.id = debt_plan_id and dp.user_id = auth.uid())
    and exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid())
  );
create policy "debt_plan_priorities_update_own" on public.debt_plan_priorities
  for update using (
    exists (select 1 from public.debt_plans dp where dp.id = debt_plan_id and dp.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.debt_plans dp where dp.id = debt_plan_id and dp.user_id = auth.uid())
    and exists (select 1 from public.liabilities l where l.id = liability_id and l.user_id = auth.uid())
  );
create policy "debt_plan_priorities_delete_own" on public.debt_plan_priorities
  for delete using (
    exists (select 1 from public.debt_plans dp where dp.id = debt_plan_id and dp.user_id = auth.uid())
  );

-- forecast_scenarios: fully scoped to the owning user.
create policy "forecast_scenarios_select_own" on public.forecast_scenarios
  for select using (user_id = auth.uid());
create policy "forecast_scenarios_insert_own" on public.forecast_scenarios
  for insert with check (user_id = auth.uid());
create policy "forecast_scenarios_update_own" on public.forecast_scenarios
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "forecast_scenarios_delete_own" on public.forecast_scenarios
  for delete using (user_id = auth.uid());
