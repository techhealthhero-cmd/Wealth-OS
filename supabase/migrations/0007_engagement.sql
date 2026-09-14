-- =============================================================================
-- WEALTH OS — Migration 0007: Day 6 Engagement & Automation
--
-- Adds: wealth_missions, xp_events, recurring_transactions,
-- detected_subscriptions, notification_preferences, financial_notifications,
-- monthly_reviews.
--
-- Deliberately NOT created:
--   - "wealth_mission_progress" / a separate XP ledger summary table — same
--     reasoning as Day 5's income_missions: progress is a scalar directly on
--     the mission row, and total XP is always SUM(xp_events.xp_amount),
--     never a separately stored counter that could drift (the same
--     "derive, don't duplicate" rule this project has followed since actual
--     income was chosen to always come from `transactions`, never a second
--     column).
--   - A dedicated streaks table — every streak this task names (weekly
--     check-in, monthly review, transaction-tracking days) is derivable live
--     from dates already recorded elsewhere (`transactions.transaction_date`,
--     `monthly_reviews.completed_at`), so persisting a redundant counter
--     would be the same mistake in a new place.
--   - Reusing/renaming Day 5's `income_missions` table for Wealth Missions.
--     The two share an architecture on purpose (identical status lifecycle,
--     identical progress_quantity/target_quantity mechanic, identical
--     impact_level concept — see `wealth_missions` below, column-for-column
--     the same shape) but are kept as sibling tables rather than one
--     polymorphic table: they have different natural relationships
--     (`income_missions.related_opportunity_id` -> a catalog row;
--     `wealth_missions.related_domain` -> a tag, not a foreign key) and
--     merging them now would mean an invasive migration touching Day 5's
--     already-shipped, RLS-verified, tested table for no behavioral benefit.
--
-- Policy decision (STEP 5 required this to be explicit): recurring
-- transactions use **confirmation-first** posting (Option A) — a due
-- recurring item is surfaced to the user, who explicitly confirms it before
-- a real `transactions` row is created. Nothing is ever posted silently.
--
-- Conventions carried over from 0001-0006: UUID PKs via gen_random_uuid(),
-- NUMERIC(18,2) for money, TEXT+CHECK instead of native enums, user_id
-- ownership + RLS on every table, updated_at via the existing
-- set_updated_at() trigger.
-- =============================================================================

-- =============================================================================
-- wealth_missions — general financial-health missions (budgeting, saving,
-- debt, emergency fund, goals, review, planning). Deliberately the same
-- shape as Day 5's income_missions (status lifecycle, progress mechanic,
-- impact_level) — see file header for why they're still separate tables.
-- =============================================================================
create table public.wealth_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  mission_type text not null check (mission_type in (
    'tracking', 'budgeting', 'saving', 'debt', 'emergency_fund',
    'goals', 'income', 'review', 'planning'
  )),
  -- Which existing system this mission was generated from, for the Mission
  -- Engine Integration (STEP 10) and for the AI tool layer — a tag, not a
  -- foreign key, since the source can be any of several unrelated tables.
  related_domain text check (related_domain in (
    'priority_engine', 'wealth_score', 'income_engine', 'goals',
    'emergency_fund', 'debt_planner', 'budget', 'manual'
  )),
  target_quantity numeric(18, 2),
  progress_quantity numeric(18, 2) not null default 0 check (progress_quantity >= 0),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  due_date date,
  impact_level text not null default 'medium' check (impact_level in ('low', 'medium', 'high')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wealth_missions_user_id_idx on public.wealth_missions (user_id);
create index wealth_missions_user_status_idx on public.wealth_missions (user_id, status);

create trigger set_wealth_missions_updated_at
  before update on public.wealth_missions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- xp_events — an append-only ledger. Total XP and level are always derived
-- live by summing this table (src/lib/financial/xp.ts) — never a stored,
-- independently-updatable total that could drift out of sync.
-- =============================================================================
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'first_budget_created', 'mission_completed', 'income_mission_completed',
    'monthly_review_completed', 'goal_milestone', 'emergency_fund_milestone',
    'debt_milestone'
  )),
  xp_amount integer not null check (xp_amount > 0),
  -- Free-form reference to whatever row earned the XP (a mission id, a goal
  -- id, ...) — never a foreign key, since the source varies by event_type
  -- and this is a read-mostly audit log, not something that needs to
  -- cascade on delete.
  related_id uuid,
  created_at timestamptz not null default now()
);

create index xp_events_user_id_idx on public.xp_events (user_id);

-- =============================================================================
-- recurring_transactions — templates only. Confirmation-first: a due item
-- never posts a transaction by itself. `confirmRecurringTransaction()`
-- creates the real `transactions` row and advances `next_due_date` in the
-- same action, so a due date can never be double-confirmed once advanced.
-- =============================================================================
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(18, 2) not null check (amount > 0),
  account_id uuid references public.accounts(id) on delete set null,
  from_account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  merchant text,
  description text,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  end_date date,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_date is null or end_date >= start_date),
  check (
    (type = 'transfer' and from_account_id is not null and to_account_id is not null and account_id is null)
    or (type <> 'transfer' and account_id is not null and from_account_id is null and to_account_id is null)
  )
);

create index recurring_transactions_user_id_idx on public.recurring_transactions (user_id);
create index recurring_transactions_user_due_idx on public.recurring_transactions (user_id, next_due_date) where is_active;

create trigger set_recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- detected_subscriptions — deterministic pattern-detection results, with the
-- user's own decision persisted (a dismissed merchant must never resurface
-- on its own). Re-running the detector upserts by (user_id, merchant), so
-- confirmed/dismissed/cancelled status is never silently overwritten by a
-- fresh detection pass (the query layer only inserts brand-new candidates).
-- =============================================================================
create table public.detected_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null check (char_length(trim(merchant)) > 0),
  estimated_amount numeric(18, 2) not null check (estimated_amount > 0),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed', 'cancelled')),
  occurrence_count integer not null default 0 check (occurrence_count >= 0),
  first_seen_date date not null,
  last_seen_date date not null,
  next_expected_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, merchant)
);

create index detected_subscriptions_user_id_idx on public.detected_subscriptions (user_id);

create trigger set_detected_subscriptions_updated_at
  before update on public.detected_subscriptions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- notification_preferences — one row per user, all categories on by default.
-- =============================================================================
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  upcoming_bill boolean not null default true,
  budget_near_limit boolean not null default true,
  budget_exceeded boolean not null default true,
  recurring_payment_due boolean not null default true,
  subscription_detected boolean not null default true,
  goal_milestone boolean not null default true,
  emergency_fund_milestone boolean not null default true,
  debt_milestone boolean not null default true,
  monthly_review_due boolean not null default true,
  mission_reminder boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- financial_notifications — in-app only (no external push infrastructure).
-- `dedupe_key` + a unique constraint is the deduplication mechanism itself:
-- generating the "same unchanged condition" twice is a no-op insert
-- conflict, not application-level bookkeeping that could be gotten wrong.
-- =============================================================================
create table public.financial_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'upcoming_bill', 'budget_near_limit', 'budget_exceeded',
    'recurring_payment_due', 'subscription_detected', 'goal_milestone',
    'emergency_fund_milestone', 'debt_milestone', 'monthly_review_due',
    'mission_reminder'
  )),
  title text not null,
  body text not null,
  related_id uuid,
  -- e.g. "budget_exceeded:2026-09" — one row per user per unchanged
  -- condition, enforced at the database level, not by an application check
  -- that could race or be forgotten in a new code path.
  dedupe_key text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),

  unique (user_id, dedupe_key)
);

create index financial_notifications_user_id_idx on public.financial_notifications (user_id, created_at desc);
create index financial_notifications_user_unread_idx on public.financial_notifications (user_id) where not is_read;

-- =============================================================================
-- monthly_reviews — one per user per calendar month (unique constraint).
-- Snapshot figures are captured at completion time so a review always
-- reflects what was true when the user actually did it, even if later
-- transactions are added/edited retroactively.
-- =============================================================================
create table public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month integer not null check (month between 1 and 12),

  income_cents bigint not null default 0,
  expenses_cents bigint not null default 0,
  cash_flow_cents bigint not null default 0,
  savings_rate_percent numeric(6, 2) not null default 0,
  net_worth_change_cents bigint,
  budget_percent_used numeric(6, 2),
  debt_paid_cents bigint not null default 0,
  emergency_fund_months_protected numeric(6, 2),
  goals_progress_percent numeric(6, 2),
  income_gap_cents bigint,
  missions_completed_count integer not null default 0,

  what_went_well text,
  what_to_reduce text,
  next_month_focus text,
  notes text,

  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, year, month)
);

create index monthly_reviews_user_id_idx on public.monthly_reviews (user_id);

create trigger set_monthly_reviews_updated_at
  before update on public.monthly_reviews
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.wealth_missions enable row level security;
alter table public.xp_events enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.detected_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.financial_notifications enable row level security;
alter table public.monthly_reviews enable row level security;

-- wealth_missions
create policy "wealth_missions_select_own" on public.wealth_missions
  for select using (user_id = auth.uid());
create policy "wealth_missions_insert_own" on public.wealth_missions
  for insert with check (user_id = auth.uid());
create policy "wealth_missions_update_own" on public.wealth_missions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wealth_missions_delete_own" on public.wealth_missions
  for delete using (user_id = auth.uid());

-- xp_events: append-only from the app's point of view — select/insert only,
-- no update/delete policy (an audit ledger is never edited after the fact).
create policy "xp_events_select_own" on public.xp_events
  for select using (user_id = auth.uid());
create policy "xp_events_insert_own" on public.xp_events
  for insert with check (user_id = auth.uid());

-- recurring_transactions: fully scoped, and any referenced account must
-- also be the user's own (same ownership-chain pattern as transactions).
create policy "recurring_transactions_select_own" on public.recurring_transactions
  for select using (user_id = auth.uid());
create policy "recurring_transactions_insert_own" on public.recurring_transactions
  for insert with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (from_account_id is null or exists (select 1 from public.accounts a where a.id = from_account_id and a.user_id = auth.uid()))
    and (to_account_id is null or exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()))
  );
create policy "recurring_transactions_update_own" on public.recurring_transactions
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (from_account_id is null or exists (select 1 from public.accounts a where a.id = from_account_id and a.user_id = auth.uid()))
    and (to_account_id is null or exists (select 1 from public.accounts a where a.id = to_account_id and a.user_id = auth.uid()))
  );
create policy "recurring_transactions_delete_own" on public.recurring_transactions
  for delete using (user_id = auth.uid());

-- detected_subscriptions
create policy "detected_subscriptions_select_own" on public.detected_subscriptions
  for select using (user_id = auth.uid());
create policy "detected_subscriptions_insert_own" on public.detected_subscriptions
  for insert with check (user_id = auth.uid());
create policy "detected_subscriptions_update_own" on public.detected_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "detected_subscriptions_delete_own" on public.detected_subscriptions
  for delete using (user_id = auth.uid());

-- notification_preferences
create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (user_id = auth.uid());
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (user_id = auth.uid());
create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- financial_notifications: select/update (mark read)/delete — insert is via
-- server-side generation only using the authenticated user's own id, same
-- policy shape as every other owned table (still enforced, never trusts a
-- client-supplied user_id).
create policy "financial_notifications_select_own" on public.financial_notifications
  for select using (user_id = auth.uid());
create policy "financial_notifications_insert_own" on public.financial_notifications
  for insert with check (user_id = auth.uid());
create policy "financial_notifications_update_own" on public.financial_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "financial_notifications_delete_own" on public.financial_notifications
  for delete using (user_id = auth.uid());

-- monthly_reviews
create policy "monthly_reviews_select_own" on public.monthly_reviews
  for select using (user_id = auth.uid());
create policy "monthly_reviews_insert_own" on public.monthly_reviews
  for insert with check (user_id = auth.uid());
create policy "monthly_reviews_update_own" on public.monthly_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "monthly_reviews_delete_own" on public.monthly_reviews
  for delete using (user_id = auth.uid());
