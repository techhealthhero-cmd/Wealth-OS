-- =============================================================================
-- WEALTH OS — Migration 0002: system categories
--
-- These are shared, read-only categories (user_id IS NULL, is_system = true)
-- visible to every authenticated user via the
-- "categories_select_own_or_system" RLS policy. They ship with every
-- environment (not just demo data), so they live in a migration rather than
-- supabase/seed.sql.
-- =============================================================================

insert into public.categories (name_th, name_en, type, icon, is_system, sort_order) values
  -- Expense categories
  ('อาหาร', 'Food & Dining', 'expense', 'utensils', true, 10),
  ('เดินทาง', 'Transport', 'expense', 'car', true, 20),
  ('ที่พัก', 'Housing', 'expense', 'home', true, 30),
  ('ช้อปปิ้ง', 'Shopping', 'expense', 'shopping-bag', true, 40),
  ('สุขภาพ', 'Health', 'expense', 'heart-pulse', true, 50),
  ('ความบันเทิง', 'Entertainment', 'expense', 'film', true, 60),
  ('การศึกษา', 'Education', 'expense', 'graduation-cap', true, 70),
  ('ค่าสาธารณูปโภค', 'Utilities', 'expense', 'plug-zap', true, 80),
  ('สมาชิก/Subscription', 'Subscriptions', 'expense', 'repeat', true, 90),
  ('ประกัน', 'Insurance', 'expense', 'shield', true, 100),
  ('ครอบครัว', 'Family', 'expense', 'users', true, 110),
  ('อื่นๆ', 'Other', 'expense', 'more-horizontal', true, 120),
  -- Income categories
  ('เงินเดือน', 'Salary', 'income', 'wallet', true, 10),
  ('ฟรีแลนซ์', 'Freelance', 'income', 'laptop', true, 20),
  ('ธุรกิจ', 'Business', 'income', 'briefcase', true, 30),
  ('โบนัส', 'Bonus', 'income', 'gift', true, 40),
  ('คอมมิชชัน', 'Commission', 'income', 'percent', true, 50),
  ('ดอกเบี้ย', 'Interest', 'income', 'landmark', true, 60),
  ('เงินคืน', 'Cashback/Refund', 'income', 'rotate-ccw', true, 70),
  ('อื่นๆ', 'Other', 'income', 'more-horizontal', true, 80);
