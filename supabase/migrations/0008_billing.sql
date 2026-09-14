-- =============================================================================
-- WEALTH OS — Migration 0008: Day 7 SaaS / Subscriptions / Billing
--
-- Adds: subscriptions, billing_events.
--
-- Deliberately NOT created:
--   - "usage_counters" — AI usage limiting (STEP 6) reuses Day 4's
--     `ai_usage_log` directly: a live COUNT of that table scoped to the
--     current calendar-month billing period (see
--     src/lib/billing/ai-usage.ts) is always correct and can never drift
--     from the real per-request log, whereas a separately maintained
--     counter could. Same "derive, don't duplicate" reasoning 0006/0007
--     already applied to XP totals and streaks.
--   - "plan_overrides" — no genuine need for one yet (no comp/grandfather
--     use case exists in this product today). If one is needed later, an
--     admin can already set `subscriptions.plan` directly via the
--     service-role client; a dedicated overrides table can be added without
--     touching this migration.
--
-- Source of truth chain (STEP 4): billing provider -> webhook
-- (/api/billing/webhook, service-role writes only) -> subscriptions table
-- -> src/lib/billing/entitlements.ts resolver -> every server action/page.
-- Client-supplied plan values are never trusted; RLS below enforces this at
-- the database layer too, not just in application code.
--
-- Conventions carried over from 0001-0007: UUID PKs via gen_random_uuid(),
-- TEXT+CHECK instead of native enums, user_id ownership + RLS, updated_at
-- via the existing set_updated_at() trigger.
-- =============================================================================

-- =============================================================================
-- subscriptions — one row per user's current subscription state. A missing
-- row is equivalent to plan='free'/status='free' (application code treats
-- "no row" as Free rather than requiring one to be pre-created for every
-- signup, avoiding an unnecessary trigger change to 0001's handle_new_user).
-- =============================================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro')),
  status text not null default 'free' check (status in (
    'free', 'trialing', 'active', 'past_due', 'canceled', 'incomplete'
  )),
  provider text check (provider in ('stripe')),
  provider_customer_id text,
  provider_subscription_id text,
  provider_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_provider_customer_id_idx on public.subscriptions (provider_customer_id);
create index subscriptions_provider_subscription_id_idx on public.subscriptions (provider_subscription_id);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- billing_events — webhook delivery ledger (STEP 15 idempotency). Not a
-- user-owned table (no user_id — a single webhook event can arrive before
-- the corresponding subscriptions row does, and its own identity is the
-- provider's event id, not a user). Every webhook handler call looks up
-- (provider, provider_event_id) here before applying any state change, and
-- inserts before returning 200 — a duplicate delivery becomes a no-op.
-- =============================================================================
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null,
  -- Raw payload kept for audit/debugging only. Never trusted for
  -- authorization without the signature verification that already happened
  -- before this row is written (see src/lib/billing/provider.ts
  -- verifyWebhook()) — RLS below denies all client access regardless.
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

-- subscriptions: users may READ their own billing state only. Deliberately
-- NO insert/update/delete policy for the authenticated role — a user must
-- never be able to grant or modify their own paid plan. All writes happen
-- exclusively through the service-role client (checkout bootstrap, webhook
-- handler), which bypasses RLS entirely by design (see
-- src/lib/supabase/admin.ts). This is the DB-level enforcement of STEP 4's
-- "do not trust client-supplied plan values."
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());

-- billing_events: no policies at all for the authenticated/anon roles —
-- default-deny. Only the service-role webhook handler ever reads or writes
-- this table; it isn't user-scoped data and no end user ever needs to see
-- raw webhook payloads or event ids.
