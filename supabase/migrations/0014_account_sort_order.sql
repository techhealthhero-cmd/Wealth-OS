-- =============================================================================
-- accounts.sort_order — user-controlled manual ordering for the accounts
-- list (long-press-to-drag reorder on /money/accounts), replacing the
-- previous implicit "created_at ascending" order. Naming matches the
-- existing `categories.sort_order` convention (0001_init.sql).
--
-- Deliberately NOT unique per user: a reorder writes a full 0..n-1
-- renumbering, but each row is updated with its own statement (not one
-- atomic transaction from the client's perspective), so a moment where two
-- rows briefly share a value is possible mid-reorder. A unique constraint
-- would need deferrable checking (or a single RPC doing a two-phase
-- renumber) to avoid spurious 23505 errors on an ordinary drag — not worth
-- the complexity for a value that's purely a display sort key, never a
-- business-logic identity. `order by sort_order, created_at` (a tie-breaker
-- also already the existing convention for accounts) stays fully
-- deterministic even if two rows temporarily tie.
-- =============================================================================
alter table public.accounts
  add column sort_order integer not null default 0;

-- Backfill existing rows in their current (created_at) order so nothing
-- visibly reshuffles for an existing user on first deploy.
with ordered as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.accounts
)
update public.accounts a
set sort_order = ordered.rn
from ordered
where a.id = ordered.id;

create index accounts_user_sort_order_idx on public.accounts (user_id, sort_order);
