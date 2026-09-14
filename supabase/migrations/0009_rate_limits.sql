-- =============================================================================
-- WEALTH OS — Migration 0009: Day 8 Rate Limiting / Abuse Protection
--
-- Adds: rate_limit_buckets.
--
-- Why a DB-backed limiter rather than in-memory: this app deploys to a
-- serverless host (Vercel) where each function invocation can land on a
-- different instance with its own memory — an in-memory counter would reset
-- constantly and never actually limit anything across requests. Postgres
-- (already this app's single source of truth for everything else) is the
-- one piece of shared state every instance can see consistently. The
-- atomic check-and-increment happens inside check_rate_limit() below rather
-- than a read-then-write in application code, closing the race condition
-- two concurrent requests from the same key would otherwise hit.
--
-- Not user-owned data (a key is "user:<uuid>:action" or "ip:<addr>:action",
-- not a row belonging to one user's account) — RLS is enabled with zero
-- policies, the same default-deny pattern as 0008's billing_events. Only
-- the service-role client (src/lib/rate-limit.ts) ever touches this table.
-- =============================================================================

create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Fixed-window counter, reset when the window has elapsed. Atomic: the
-- whole check-and-increment happens in one statement/transaction, so two
-- concurrent requests for the same key can't both read a stale count and
-- both decide they're under the limit.
create or replace function public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_count integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limit_buckets (key, window_start, count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set
      -- Window elapsed: start a fresh window at count 1. Still inside the
      -- window: increment. Either way this is the one write for this row.
      count = case
        when public.rate_limit_buckets.window_start <= v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.rate_limit_buckets.count + 1
      end,
      window_start = case
        when public.rate_limit_buckets.window_start <= v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.rate_limit_buckets.window_start
      end,
      updated_at = v_now
  returning count into v_count;

  return v_count <= p_max_count;
end;
$$;

-- No index needed beyond the primary key (`key` is always looked up by
-- exact match, never range-scanned) — a periodic cleanup of stale rows is
-- unnecessary for the same reason ai_usage_log doesn't prune itself: row
-- volume here is one row per distinct (identity, action) pair, not one per
-- request.

alter table public.rate_limit_buckets enable row level security;
-- No policies — default deny for direct table access by the
-- authenticated/anon roles. The only sanctioned access path is the
-- SECURITY DEFINER function above, which runs with its owner's privileges
-- regardless of caller role — see the explicit grants below.

-- Deliberately grantable to anon too: login/signup abuse protection must
-- work for a request that has no session yet. The function only ever
-- touches this one counter table under its own elevated privilege — it
-- can't be used to read or write anything else.
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;
