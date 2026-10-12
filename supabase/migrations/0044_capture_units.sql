-- =============================================================================
-- WEALTH OS — Migration 0044: Counted units in voice/quick capture
--
-- "วันนี้ได้ 10 ดื่ม": some people are paid per unit — a host earns ฿200 per
-- drink. One row per (user, unit word) holds the price per unit, whether it
-- is income or spending, and the category, so "ได้ 10 ดื่ม" is captured as
-- 10 × ฿200 = ฿2,000 income instead of a ฿10 expense.
--
-- Same plain-mapping shape as merchant_account_preferences (0042). Rows come
-- from the user, never from a guess:
--   'user'    — added on the profile page
--   'learned' — the user answered "how much per <unit>?" in capture
-- =============================================================================

create table public.capture_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The unit word as matched in speech ("ดื่ม"), lowercased.
  unit_normalized text not null check (char_length(unit_normalized) between 1 and 40),
  -- What the user saw/typed, for display.
  unit_label text not null check (char_length(btrim(unit_label)) between 1 and 40),
  unit_price numeric(18, 2) not null check (unit_price > 0),
  type text not null default 'income' check (type in ('income', 'expense')),
  -- A system category or one of the user's own; null = let capture suggest one.
  category_id uuid references public.categories(id) on delete set null,
  source text not null default 'user' check (source in ('user', 'learned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.capture_units is
  'Per-unit prices for capture ("ดื่ม" = ฿200 income). Only turns a spoken count into an amount; never moves money.';

-- One price per unit word; answering again re-prices it.
create unique index capture_units_user_unit_idx
  on public.capture_units (user_id, unit_normalized);

create trigger set_capture_units_updated_at
  before update on public.capture_units
  for each row execute function public.set_updated_at();

-- The category must be a system category or the same user's own (a foreign
-- key alone doesn't check ownership — same reasoning as 0013 / 0042).
create or replace function public.check_capture_unit_category_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories
    where id = new.category_id and (user_id is null or user_id = new.user_id)
  ) then
    raise exception 'category_id must reference a system category or one owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_capture_unit_category_ownership_trg
  before insert or update of category_id, user_id on public.capture_units
  for each row execute function public.check_capture_unit_category_ownership();

alter table public.capture_units enable row level security;

create policy "capture_units_select_own" on public.capture_units
  for select using (user_id = auth.uid());
create policy "capture_units_insert_own" on public.capture_units
  for insert with check (user_id = auth.uid());
create policy "capture_units_update_own" on public.capture_units
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "capture_units_delete_own" on public.capture_units
  for delete using (user_id = auth.uid());
