-- =============================================================================
-- WEALTH OS — Migration 0039: "Gift" system categories
--
-- Requested 2026-10-05: money received as a gift ("พี่โอนเงินให้ค่าวันเกิด",
-- อั่งเปา, ของขวัญ) had nowhere to go but income "Other", and buying a gift
-- for someone fell to expense "Other". One system category per type, shared
-- read-only like every row in 0002 (user_id IS NULL, is_system = true).
--
-- Idempotent: safe to re-run; skips a type that already has a system Gift.
-- =============================================================================

insert into public.categories (name_th, name_en, type, icon, is_system, sort_order)
select v.name_th, v.name_en, v.type, v.icon, true, v.sort_order
from (values
  ('ของขวัญ', 'Gift', 'expense', 'gift', 115),
  ('ของขวัญ/เงินที่ได้รับ', 'Gift', 'income', 'gift-received', 75)
) as v(name_th, name_en, type, icon, sort_order)
where not exists (
  select 1 from public.categories c
  where c.is_system and c.user_id is null and c.name_en = v.name_en and c.type = v.type
);
