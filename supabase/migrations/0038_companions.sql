-- =============================================================================
-- 0038 — AI companions (ภูติ / จอมเวท).
--
-- user_companions: which progress-earned companions (spirits) a user has
-- unlocked. Unlocks are granted ONLY by the server after a deterministic
-- check of the user's real financial data (src/lib/companions/unlock.ts) —
-- so there is deliberately no insert/update/delete policy for regular
-- users: a client could otherwise grant itself any companion through the
-- REST API. The server writes with the service-role client, always using
-- the authenticated user's own id. Unlocks are permanent (no revocation on
-- a bad month — PRODUCT_OUTCOMES.md: no punitive resets).
--
-- Plan-gated companions (wizards) are never stored here: they're derived
-- from the user's current plan on every read, so they follow upgrades and
-- downgrades automatically.
--
-- profiles.selected_companion_id: the user's chosen companion. A plain
-- preference the user may write themselves (existing profiles update-own
-- RLS); the server validates it on every read and falls back to the
-- starter companion if it isn't actually available to this user.
-- =============================================================================

create table public.user_companions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  companion_id text not null check (companion_id ~ '^[a-z0-9-]{1,64}$'),
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, companion_id)
);

create index user_companions_user_id_idx on public.user_companions (user_id);

create trigger set_user_companions_updated_at
  before update on public.user_companions
  for each row execute function public.set_updated_at();

alter table public.user_companions enable row level security;

create policy "user_companions_select_own" on public.user_companions
  for select using (user_id = auth.uid());

alter table public.profiles
  add column selected_companion_id text
    check (selected_companion_id is null or selected_companion_id ~ '^[a-z0-9-]{1,64}$');
