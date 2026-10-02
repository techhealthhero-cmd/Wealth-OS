-- =============================================================================
-- 0037 — Separate AI quotas: chat vs. capture assists.
--
-- ai_usage_log counted every AI call against the AI Money Coach monthly
-- message quota, so Quick Capture's small helpers (slip scan, sentence
-- reading, recap categories) silently used up a Free user's 15 chat
-- messages. Each row now records which feature spent it.
--
-- Additive only: every existing row becomes 'chat' (the column default),
-- which is exactly how they were counted before — no quota changes for the
-- current month beyond capture usage no longer counting from now on.
-- RLS is unchanged (insert/select own rows, from 0005).
-- =============================================================================

alter table public.ai_usage_log
  add column feature text not null default 'chat' check (feature in ('chat', 'capture'));

create index ai_usage_log_user_feature_idx on public.ai_usage_log (user_id, feature, created_at);
