-- =============================================================================
-- WEALTH OS — Migration 0005: Day 4 AI Money Coach
--
-- Adds: ai_conversations, ai_messages, ai_usage_log.
--
-- Deliberately NOT persisted here:
--   - The Financial Context sent with each chat turn — it is rebuilt fresh
--     from live data on every request (see src/features/ai/lib/context-
--     builder.ts). Storing snapshots would let AI answers drift from current
--     truth and violates the "no unnecessary raw context snapshots" rule.
--   - Next Best Action / Monthly Health Check / AI Insight results — all
--     computed live, zero-LLM-call, from existing tables. Nothing new to
--     store; see src/features/ai/lib/{health-check,insights}.ts and
--     src/features/ai/components/next-best-action-card.tsx.
--   - Billing/subscription limits — ai_usage_log only records counters for a
--     future Day 7 limiter to read; no plan/quota logic lives here yet.
--
-- Conventions carried over from 0001/0003/0004: UUID PKs via
-- gen_random_uuid(), user_id ownership + RLS on every table, updated_at via
-- the existing set_updated_at() trigger where a row is ever updated.
-- =============================================================================

-- =============================================================================
-- ai_conversations — one row per chat thread.
-- =============================================================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user_id_idx on public.ai_conversations (user_id);

create trigger set_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ai_messages — messages within a conversation. Immutable once written (no
-- updated_at/update policy) — a chat transcript is an append-only log.
-- =============================================================================
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_id_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_user_id_idx on public.ai_messages (user_id);

-- =============================================================================
-- ai_usage_log — lightweight per-request counters for a future Day 7
-- Free/Plus/Pro limiter. No billing/plan logic yet — just the raw counts.
-- =============================================================================
create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_log_user_id_idx on public.ai_usage_log (user_id, created_at);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_log enable row level security;

-- ai_conversations: fully scoped to the owning user.
create policy "ai_conversations_select_own" on public.ai_conversations
  for select using (user_id = auth.uid());
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert with check (user_id = auth.uid());
create policy "ai_conversations_update_own" on public.ai_conversations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete using (user_id = auth.uid());

-- ai_messages: scoped to the owning user, and the parent conversation must
-- also be the user's own (same double-ownership-check pattern as
-- debt_plan_priorities in 0004). No update policy — messages are immutable.
create policy "ai_messages_select_own" on public.ai_messages
  for select using (user_id = auth.uid());
create policy "ai_messages_insert_own" on public.ai_messages
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );
create policy "ai_messages_delete_own" on public.ai_messages
  for delete using (user_id = auth.uid());

-- ai_usage_log: insert/select only, scoped to the owning user. No update or
-- delete policy — a usage log is an append-only audit trail.
create policy "ai_usage_log_select_own" on public.ai_usage_log
  for select using (user_id = auth.uid());
create policy "ai_usage_log_insert_own" on public.ai_usage_log
  for insert with check (user_id = auth.uid());
