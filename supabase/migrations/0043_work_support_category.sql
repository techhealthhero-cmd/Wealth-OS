-- =============================================================================
-- WEALTH OS — Migration 0043: "Work Support" system expense category
--
-- Requested 2026-10-12: spending that supports the user's work (equipment,
-- stationery, printing, co-working, software/hosting for a job or side
-- income) had nowhere to go but "Other". Shared read-only like every row in
-- 0002 (user_id IS NULL, is_system = true); sorted just before "Other".
--
-- Idempotent: safe to re-run; skips if the system row already exists.
-- =============================================================================

insert into public.categories (name_th, name_en, type, icon, is_system, sort_order)
select v.name_th, v.name_en, v.type, v.icon, true, v.sort_order
from (values
  ('สนับสนุนทำงาน', 'Work Support', 'expense', 'tools', 117)
) as v(name_th, name_en, type, icon, sort_order)
where not exists (
  select 1 from public.categories c
  where c.is_system and c.user_id is null and c.name_en = v.name_en and c.type = v.type
);
