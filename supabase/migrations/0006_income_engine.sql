-- =============================================================================
-- WEALTH OS — Migration 0006: Day 5 Income Engine
--
-- Adds: income_sources, user_skills, income_targets, income_opportunities
-- (a global read-only catalog, seeded below), income_missions.
--
-- Deliberately NOT created:
--   - "income_mission_progress" — progress is a scalar (`progress_quantity`)
--     plus `status` directly on `income_missions`; a mission's progress has
--     no history requirement in this spec, so a child table would be an
--     unused join for no benefit (same reasoning as Day 3's "no
--     forecast_snapshots table").
--   - A second "actual monthly income" column anywhere — `transactions`
--     (Day 1) remains the sole source of truth for real received income;
--     `income_sources.expected_monthly_income` is a planning figure only,
--     never a competing "actual" number.
--
-- Conventions carried over from 0001/0003/0004/0005: UUID PKs via
-- gen_random_uuid(), NUMERIC(18,2) for money, TEXT+CHECK instead of native
-- enums, user_id ownership + RLS on every user-owned table, updated_at via
-- the existing set_updated_at() trigger. `income_opportunities` is the one
-- exception — a global, read-only catalog with no `user_id`, following the
-- same "shared reference data" shape as `categories`' system rows.
-- =============================================================================

-- =============================================================================
-- income_sources — a user's planned/expected income sources. Real received
-- income is still only ever read from `transactions`.
-- =============================================================================
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  source_type text not null check (source_type in (
    'salary', 'freelance', 'business', 'commission', 'bonus',
    'investment', 'rental', 'side_hustle', 'other'
  )),
  expected_monthly_income numeric(18, 2) not null default 0 check (expected_monthly_income >= 0),
  stability text not null default 'variable' check (stability in ('stable', 'variable')),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'biweekly', 'weekly', 'irregular', 'one_time')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_sources_user_id_idx on public.income_sources (user_id);

create trigger set_income_sources_updated_at
  before update on public.income_sources
  for each row execute function public.set_updated_at();

-- =============================================================================
-- user_skills — self-reported skills. No "verified" concept — proficiency
-- and experience are the user's own claim, never independently confirmed.
-- =============================================================================
create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_name text not null check (char_length(trim(skill_name)) > 0),
  category text not null check (category in (
    'web_development', 'design', 'sales', 'marketing', 'fitness', 'teaching',
    'translation', 'video_editing', 'photography', 'accounting', 'writing',
    'customer_service', 'other'
  )),
  proficiency_level text not null default 'beginner' check (proficiency_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  experience_months integer check (experience_months is null or experience_months >= 0),
  monetized_before boolean not null default false,
  notes text,
  interest_level text not null default 'medium' check (interest_level in ('low', 'medium', 'high')),
  available_hours_per_week numeric(6, 2) check (available_hours_per_week is null or available_hours_per_week >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_skills_user_id_idx on public.user_skills (user_id);

create trigger set_user_skills_updated_at
  before update on public.user_skills
  for each row execute function public.set_updated_at();

-- =============================================================================
-- income_targets — one row per user (their current goal). Unlike Money Year,
-- this has no versioning requirement in this spec — it's a single live
-- target, always editable in place.
-- =============================================================================
create table public.income_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  target_monthly_income numeric(18, 2) check (target_monthly_income is null or target_monthly_income >= 0),
  desired_extra_income numeric(18, 2) check (desired_extra_income is null or desired_extra_income >= 0),
  target_date date,
  preferred_income_type text not null default 'any' check (preferred_income_type in ('active', 'passive', 'any')),
  max_hours_per_week numeric(6, 2) check (max_hours_per_week is null or max_hours_per_week >= 0),
  max_startup_cost numeric(18, 2) check (max_startup_cost is null or max_startup_cost >= 0),
  work_mode_preference text not null default 'any' check (work_mode_preference in ('online', 'offline', 'both', 'any')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_income_targets_updated_at
  before update on public.income_targets
  for each row execute function public.set_updated_at();

-- =============================================================================
-- income_opportunities — a global, read-only catalog of side-hustle/income
-- opportunity types (seeded below). No `user_id`: every user sees the same
-- catalog, ranked differently per-user at query time by the deterministic
-- scoring model — never a per-user copy of catalog rows.
-- =============================================================================
create table public.income_opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  description_th text not null,
  description_en text not null,
  required_skill_categories text[] not null default '{}',
  recommended_proficiency text not null check (recommended_proficiency in ('beginner', 'intermediate', 'advanced', 'expert')),
  estimated_startup_cost_min numeric(18, 2) not null default 0 check (estimated_startup_cost_min >= 0),
  estimated_startup_cost_max numeric(18, 2) not null default 0 check (estimated_startup_cost_max >= estimated_startup_cost_min),
  estimated_hours_per_week_min numeric(6, 2) not null default 0 check (estimated_hours_per_week_min >= 0),
  estimated_hours_per_week_max numeric(6, 2) not null default 0 check (estimated_hours_per_week_max >= estimated_hours_per_week_min),
  income_model text not null check (income_model in ('hourly', 'project', 'recurring', 'product', 'commission')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  work_mode text not null check (work_mode in ('online', 'offline', 'both')),
  scalability text not null check (scalability in ('low', 'medium', 'high')),
  time_to_first_income text not null check (time_to_first_income in ('fast', 'medium', 'slow')),
  -- Rough, clearly-labeled examples only — never rendered as a guarantee.
  estimated_monthly_income_min numeric(18, 2) not null default 0 check (estimated_monthly_income_min >= 0),
  estimated_monthly_income_max numeric(18, 2) not null default 0 check (estimated_monthly_income_max >= estimated_monthly_income_min),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_income_opportunities_updated_at
  before update on public.income_opportunities
  for each row execute function public.set_updated_at();

-- =============================================================================
-- income_missions — concrete, generated action items. Practical and
-- specific by construction (deterministic templates decide the title/type),
-- never a vague "work harder."
-- =============================================================================
create table public.income_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  related_opportunity_id uuid references public.income_opportunities(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  mission_type text not null check (mission_type in (
    'define_offer', 'build_portfolio', 'set_price', 'create_profile',
    'outreach', 'follow_up', 'publish_offer', 'close_client',
    'list_product', 'raise_price', 'ask_referral', 'other'
  )),
  target_quantity numeric(10, 2),
  progress_quantity numeric(10, 2) not null default 0 check (progress_quantity >= 0),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'skipped')),
  sequence_order integer not null default 0,
  due_date date,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  impact_level text not null default 'medium' check (impact_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_missions_user_id_idx on public.income_missions (user_id);
create index income_missions_user_status_idx on public.income_missions (user_id, status);
create index income_missions_user_sequence_idx on public.income_missions (user_id, sequence_order);

create trigger set_income_missions_updated_at
  before update on public.income_missions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.income_sources enable row level security;
alter table public.user_skills enable row level security;
alter table public.income_targets enable row level security;
alter table public.income_opportunities enable row level security;
alter table public.income_missions enable row level security;

-- income_sources: fully scoped to the owning user.
create policy "income_sources_select_own" on public.income_sources
  for select using (user_id = auth.uid());
create policy "income_sources_insert_own" on public.income_sources
  for insert with check (user_id = auth.uid());
create policy "income_sources_update_own" on public.income_sources
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_sources_delete_own" on public.income_sources
  for delete using (user_id = auth.uid());

-- user_skills: fully scoped to the owning user.
create policy "user_skills_select_own" on public.user_skills
  for select using (user_id = auth.uid());
create policy "user_skills_insert_own" on public.user_skills
  for insert with check (user_id = auth.uid());
create policy "user_skills_update_own" on public.user_skills
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_skills_delete_own" on public.user_skills
  for delete using (user_id = auth.uid());

-- income_targets: fully scoped to the owning user.
create policy "income_targets_select_own" on public.income_targets
  for select using (user_id = auth.uid());
create policy "income_targets_insert_own" on public.income_targets
  for insert with check (user_id = auth.uid());
create policy "income_targets_update_own" on public.income_targets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_targets_delete_own" on public.income_targets
  for delete using (user_id = auth.uid());

-- income_opportunities: readable by every authenticated user; writable by
-- no one at the application layer (catalog is maintained via migrations).
create policy "income_opportunities_select_all" on public.income_opportunities
  for select using (true);

-- income_missions: fully scoped to the owning user. `related_opportunity_id`
-- needs no ownership check — the catalog it points to is global, not
-- user-owned.
create policy "income_missions_select_own" on public.income_missions
  for select using (user_id = auth.uid());
create policy "income_missions_insert_own" on public.income_missions
  for insert with check (user_id = auth.uid());
create policy "income_missions_update_own" on public.income_missions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_missions_delete_own" on public.income_missions
  for delete using (user_id = auth.uid());

-- =============================================================================
-- Seed: income_opportunities catalog
-- =============================================================================
insert into public.income_opportunities (
  slug, name_th, name_en, description_th, description_en, required_skill_categories,
  recommended_proficiency, estimated_startup_cost_min, estimated_startup_cost_max,
  estimated_hours_per_week_min, estimated_hours_per_week_max, income_model, difficulty,
  work_mode, scalability, time_to_first_income, estimated_monthly_income_min, estimated_monthly_income_max
) values
  ('freelance_web_dev', 'รับพัฒนาเว็บไซต์ฟรีแลนซ์', 'Freelance web development',
   'รับงานพัฒนาเว็บไซต์หรือเว็บแอปให้ลูกค้าเป็นโปรเจกต์', 'Build websites or web apps for clients on a project basis',
   array['web_development'], 'intermediate', 0, 5000, 5, 25, 'project', 'medium', 'online', 'medium', 'medium', 15000, 60000),

  ('landing_page_service', 'รับทำ Landing Page', 'Landing page service',
   'ออกแบบและสร้างหน้า Landing Page สำหรับธุรกิจขนาดเล็ก', 'Design and build landing pages for small businesses',
   array['web_development', 'design'], 'beginner', 0, 3000, 3, 15, 'project', 'easy', 'online', 'medium', 'fast', 5000, 25000),

  ('website_maintenance', 'รับดูแลเว็บไซต์รายเดือน', 'Website maintenance retainer',
   'ดูแลอัปเดตและแก้ปัญหาเว็บไซต์ให้ลูกค้าเป็นรายเดือน', 'Ongoing monthly website updates and fixes for clients',
   array['web_development'], 'intermediate', 0, 2000, 2, 10, 'recurring', 'easy', 'online', 'medium', 'medium', 3000, 20000),

  ('automation_setup', 'รับวางระบบ Automation', 'Automation setup service',
   'ช่วยธุรกิจตั้งค่าระบบอัตโนมัติ เช่น เชื่อมต่อเครื่องมือ ลดงานที่ทำซ้ำ', 'Help businesses set up automations that connect tools and cut repetitive work',
   array['web_development'], 'advanced', 0, 3000, 3, 15, 'project', 'hard', 'online', 'medium', 'medium', 8000, 40000),

  ('personal_training', 'เทรนเนอร์ส่วนตัว', 'Personal training',
   'ให้คำแนะนำและฝึกสอนออกกำลังกายแบบตัวต่อตัวหรือกลุ่มเล็ก', 'One-on-one or small-group fitness coaching',
   array['fitness'], 'intermediate', 0, 10000, 5, 25, 'hourly', 'medium', 'offline', 'low', 'medium', 8000, 35000),

  ('online_coaching', 'โค้ชออนไลน์', 'Online coaching',
   'ให้คำปรึกษาหรือโค้ชด้านทักษะเฉพาะทางผ่านวิดีโอคอล', 'Coach clients on a specific skill or goal over video calls',
   array['fitness', 'teaching', 'marketing', 'sales'], 'advanced', 0, 2000, 3, 15, 'recurring', 'medium', 'online', 'high', 'medium', 10000, 50000),

  ('language_tutoring', 'สอนภาษาออนไลน์', 'Language tutoring',
   'สอนภาษาแบบตัวต่อตัวหรือกลุ่มเล็กผ่านออนไลน์', 'Teach a language one-on-one or in small groups online',
   array['teaching', 'translation'], 'intermediate', 0, 1000, 3, 20, 'hourly', 'easy', 'online', 'medium', 'fast', 6000, 30000),

  ('translation_service', 'รับแปลเอกสาร', 'Translation service',
   'รับแปลเอกสารหรือเนื้อหาระหว่างภาษา', 'Translate documents or content between languages',
   array['translation', 'writing'], 'intermediate', 0, 500, 3, 20, 'project', 'easy', 'online', 'low', 'fast', 5000, 25000),

  ('content_editing', 'รับตัดต่อ/แก้ไขเนื้อหา', 'Content editing service',
   'รับแก้ไขบทความ งานเขียน หรือสคริปต์ให้ลูกค้า', 'Edit articles, written content, or scripts for clients',
   array['writing'], 'intermediate', 0, 500, 3, 15, 'project', 'easy', 'online', 'low', 'fast', 5000, 20000),

  ('short_video_editing', 'รับตัดต่อวิดีโอสั้น', 'Short-form video editing',
   'รับตัดต่อวิดีโอสั้นสำหรับโซเชียลมีเดียให้ลูกค้าหรือครีเอเตอร์', 'Edit short-form videos for social media clients or creators',
   array['video_editing'], 'intermediate', 0, 15000, 5, 25, 'project', 'medium', 'online', 'medium', 'medium', 8000, 35000),

  ('social_media_management', 'รับดูแลโซเชียลมีเดีย', 'Social media management',
   'วางแผนและดูแลคอนเทนต์โซเชียลมีเดียให้ธุรกิจ', 'Plan and manage social media content for a business',
   array['marketing', 'design', 'writing'], 'intermediate', 0, 2000, 5, 20, 'recurring', 'medium', 'online', 'medium', 'medium', 8000, 30000),

  ('appointment_setting', 'รับงานขาย/นัดหมายลูกค้า', 'Sales / appointment setting',
   'ติดต่อและนัดหมายลูกค้าเป้าหมายให้ธุรกิจ มักได้ค่าคอมมิชชัน', 'Contact and schedule prospects for a business, usually commission-based',
   array['sales'], 'beginner', 0, 0, 5, 25, 'commission', 'easy', 'both', 'medium', 'fast', 3000, 30000),

  ('digital_product', 'ขายสินค้าดิจิทัล', 'Digital products',
   'สร้างและขายสินค้าดิจิทัล เช่น Template หรือไฟล์ดีไซน์', 'Create and sell a digital product such as templates or design files',
   array['design', 'web_development', 'writing'], 'intermediate', 0, 3000, 5, 20, 'product', 'medium', 'online', 'high', 'slow', 2000, 40000),

  ('ebook', 'เขียนและขาย E-book', 'E-book',
   'เขียนและจำหน่าย E-book ในหัวข้อที่มีความเชี่ยวชาญ', 'Write and sell an e-book on a topic you know well',
   array['writing'], 'intermediate', 0, 1000, 5, 20, 'product', 'medium', 'online', 'high', 'slow', 1000, 25000),

  ('online_course', 'สร้างคอร์สออนไลน์', 'Online course',
   'สร้างคอร์สสอนออนไลน์จากความเชี่ยวชาญที่มี', 'Build an online course from your existing expertise',
   array['teaching', 'marketing', 'video_editing'], 'advanced', 0, 5000, 10, 30, 'product', 'hard', 'online', 'high', 'slow', 3000, 60000),

  ('local_service_business', 'ธุรกิจบริการในพื้นที่', 'Local service business',
   'ให้บริการในพื้นที่ เช่น ถ่ายภาพ จัดของ ทำความสะอาด', 'Offer a local service such as photography, organizing, or cleaning',
   array['photography', 'other'], 'beginner', 1000, 20000, 10, 30, 'project', 'medium', 'offline', 'low', 'medium', 5000, 35000),

  ('consulting', 'รับที่ปรึกษาธุรกิจ', 'Consulting',
   'ให้คำปรึกษาเฉพาะทางแก่ธุรกิจตามความเชี่ยวชาญ', 'Advise businesses in your area of expertise',
   array['accounting', 'marketing', 'sales', 'other'], 'expert', 0, 2000, 5, 20, 'hourly', 'hard', 'both', 'medium', 'medium', 15000, 80000);
