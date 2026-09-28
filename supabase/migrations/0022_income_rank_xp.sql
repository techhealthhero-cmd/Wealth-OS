-- WEALTH OS — Migration 0022: weighted, append-only Income Builder Rank XP

-- Backfill completed income missions that predate the Rank system. The
-- ledger entry survives a later status undo, so a completed real action can
-- never be farmed repeatedly and a user's earned Rank never decreases.
insert into public.xp_events (user_id, event_type, xp_amount, related_id, created_at)
select
  mission.user_id,
  'income_mission_completed',
  case mission.mission_type
    when 'define_offer' then 10
    when 'build_portfolio' then 15
    when 'set_price' then 10
    when 'create_profile' then 15
    when 'outreach' then 15
    when 'follow_up' then 10
    when 'publish_offer' then 15
    when 'close_client' then 40
    when 'list_product' then 15
    when 'raise_price' then 25
    when 'ask_referral' then 30
    else 10
  end,
  mission.id,
  mission.updated_at
from public.income_missions mission
where mission.status = 'completed'
  and not exists (
    select 1
    from public.xp_events event
    where event.user_id = mission.user_id
      and event.event_type = 'income_mission_completed'
      and event.related_id = mission.id
  );

-- Enforce the same once-per-action rule at the database layer. PostgreSQL
-- permits multiple NULL values, so unrelated events without a source row
-- remain valid while mission/goal events cannot be duplicated by a race.
create unique index if not exists xp_events_user_type_related_unique_idx
  on public.xp_events (user_id, event_type, related_id)
  where related_id is not null;
