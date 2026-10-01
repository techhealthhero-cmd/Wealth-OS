-- =============================================================================
-- 0036 — Income sources: per-unit pay + "15th and end of month" frequency.
--
-- Additive only. Existing rows keep pay_basis = 'fixed' and every new
-- column null, so nothing about current data or calculations changes.
--
-- * pay_basis = 'per_unit': income earned per piece of work (e.g. ฿200 per
--   drink, per delivery, per class). The server derives
--   expected_monthly_income = unit_rate × expected_units_per_month
--   deterministically; expected_monthly_income stays the single figure the
--   Income Profile reads, so no downstream calculation changes.
-- * frequency 'semimonthly': paid twice a month on fixed dates (the 15th
--   and the last day) — distinct from 'biweekly' (every 14 days).
-- =============================================================================

-- Replace the frequency check (named by Postgres from the 0006 inline
-- constraint) with one that also allows 'semimonthly'. Looked up by
-- definition rather than assumed name so this is safe on every database.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.income_sources'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%frequency%'
  loop
    execute format('alter table public.income_sources drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.income_sources
  add constraint income_sources_frequency_check
  check (frequency in ('monthly', 'semimonthly', 'biweekly', 'weekly', 'irregular', 'one_time'));

alter table public.income_sources
  add column pay_basis text not null default 'fixed' check (pay_basis in ('fixed', 'per_unit')),
  add column unit_rate numeric(18, 2) check (unit_rate is null or unit_rate > 0),
  add column unit_label text check (unit_label is null or char_length(trim(unit_label)) between 1 and 40),
  add column expected_units_per_month numeric(12, 2) check (expected_units_per_month is null or expected_units_per_month >= 0);

-- A per-unit source must carry both inputs its monthly figure comes from.
alter table public.income_sources
  add constraint income_sources_per_unit_complete
  check (pay_basis = 'fixed' or (unit_rate is not null and expected_units_per_month is not null));
