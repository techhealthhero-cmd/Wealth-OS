-- Income Path Planner: turn interests into measurable income scenarios.

create table public.income_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references public.user_skills(id) on delete set null,
  income_source_id uuid references public.income_sources(id) on delete set null,
  interest_name text not null check (char_length(trim(interest_name)) between 1 and 80),
  offer_name text not null check (char_length(trim(offer_name)) between 1 and 100),
  category text not null default 'other' check (category in (
    'web_development', 'design', 'sales', 'marketing', 'fitness', 'teaching',
    'translation', 'video_editing', 'photography', 'accounting', 'writing',
    'customer_service', 'other'
  )),
  earning_unit text not null default 'hour' check (earning_unit in ('hour', 'person', 'session', 'job', 'item')),
  rate_per_unit numeric(18, 2) not null check (rate_per_unit > 0),
  units_per_week numeric(8, 2) not null check (units_per_week > 0 and units_per_week <= 1000),
  hours_per_unit numeric(6, 2) not null default 1 check (hours_per_unit > 0 and hours_per_unit <= 168),
  active_weeks_per_year integer not null default 48 check (active_weeks_per_year between 1 and 52),
  growth_focus text not null default 'steady' check (growth_focus in ('steady', 'more_clients', 'raise_rate', 'scale')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_plans_user_id_idx on public.income_plans (user_id, created_at desc);
create index income_plans_skill_id_idx on public.income_plans (skill_id) where skill_id is not null;

create trigger set_income_plans_updated_at
  before update on public.income_plans
  for each row execute function public.set_updated_at();

alter table public.income_plans enable row level security;

create policy "income_plans_select_own" on public.income_plans
  for select using (user_id = auth.uid());
create policy "income_plans_insert_own" on public.income_plans
  for insert with check (
    user_id = auth.uid()
    and (skill_id is null or exists (
      select 1 from public.user_skills s where s.id = skill_id and s.user_id = auth.uid()
    ))
  );
create policy "income_plans_update_own" on public.income_plans
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (skill_id is null or exists (
      select 1 from public.user_skills s where s.id = skill_id and s.user_id = auth.uid()
    ))
    and (income_source_id is null or exists (
      select 1 from public.income_sources i where i.id = income_source_id and i.user_id = auth.uid()
    ))
  );
create policy "income_plans_delete_own" on public.income_plans
  for delete using (user_id = auth.uid());
