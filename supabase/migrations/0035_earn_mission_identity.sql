-- Earn V2: give newly generated roadmap missions a stable template identity.
--
-- Existing rows intentionally remain NULL. This preserves all historical,
-- completed and result/evidence-linked missions and avoids a destructive
-- cleanup when old data contains duplicates. New generators set the key and
-- the partial unique index closes the read-before-insert race for open work.

alter table public.income_missions
  add column if not exists mission_template_key text;

create unique index if not exists income_missions_open_template_identity_idx
  on public.income_missions (
    income_path_id,
    mission_template_key,
    coalesce(earn_project_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where income_path_id is not null
    and mission_template_key is not null
    and status in ('not_started', 'in_progress');
