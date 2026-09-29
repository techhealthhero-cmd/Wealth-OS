-- Earn V2 Foundation
--
-- Additive only. This migration deliberately does not create a money ledger:
-- public.transactions remains the sole source of truth for actual money.
-- Roadmap templates remain versioned TypeScript configuration; only each
-- user's selected template version/current step are persisted here.

-- ---------------------------------------------------------------------------
-- Immutable, historical diagnostic snapshots. Reassessment inserts a new row
-- rather than updating a previous answer set.
-- ---------------------------------------------------------------------------
create table public.earn_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rules_version text not null check (char_length(trim(rules_version)) between 1 and 50),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  calculated_stage text not null check (calculated_stage in (
    'unknown', 'survive', 'cashflow', 'stability', 'grow', 'scale', 'freedom'
  )),
  reason_codes text[] not null check (
    cardinality(reason_codes) > 0
    and reason_codes <@ array[
      'diagnostic_incomplete', 'missing_income_data', 'missing_essential_expenses',
      'missing_income_reliability', 'currency_mismatch', 'no_income_for_basic_needs',
      'income_below_essential_expenses', 'income_not_reliable',
      'essential_expenses_covered', 'buffer_unknown', 'buffer_below_policy_minimum',
      'foundation_ready_for_growth', 'repeatable_income_mechanism',
      'financial_independence_evidence'
    ]::text[]
  ),
  essential_expenses_amount numeric(18, 2) not null check (essential_expenses_amount >= 0),
  essential_expenses_currency text not null check (essential_expenses_currency ~ '^[A-Z]{3}$'),
  essential_expenses_source text not null check (essential_expenses_source in ('financial_data', 'self_report')),
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index earn_assessments_user_completed_idx
  on public.earn_assessments (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- A skill is never an income path. Users may have multiple paths, including
-- multiple paths of the same type, active at the same time.
-- ---------------------------------------------------------------------------
create table public.income_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_type text not null check (path_type in (
    'career', 'freelance_service', 'business_product', 'investment'
  )),
  title text not null check (char_length(trim(title)) between 1 and 100),
  status text not null default 'planned' check (status in (
    'planned', 'active', 'paused', 'completed', 'archived'
  )),
  roadmap_template_version text not null check (char_length(trim(roadmap_template_version)) between 1 and 50),
  current_roadmap_step_key text check (
    current_roadmap_step_key is null or char_length(trim(current_roadmap_step_key)) between 1 and 80
  ),
  initialized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_paths_user_status_idx on public.income_paths (user_id, status, created_at desc);

create trigger set_income_paths_updated_at
  before update on public.income_paths
  for each row execute function public.set_updated_at();

create table public.income_path_skills (
  user_id uuid not null references auth.users(id) on delete cascade,
  income_path_id uuid not null references public.income_paths(id) on delete cascade,
  user_skill_id uuid not null references public.user_skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (income_path_id, user_skill_id)
);

create index income_path_skills_user_idx on public.income_path_skills (user_id);
create index income_path_skills_skill_idx on public.income_path_skills (user_skill_id);

-- ---------------------------------------------------------------------------
-- V2 mission metadata is nullable/defaulted so every legacy mission remains
-- valid. Completion and a result are deliberately separate concepts.
-- ---------------------------------------------------------------------------
alter table public.income_missions
  add column income_path_id uuid references public.income_paths(id) on delete set null,
  add column mission_category text check (mission_category is null or mission_category in (
    'learn', 'build', 'search', 'contact', 'sell', 'deliver', 'improve', 'financial'
  )),
  add column roadmap_step_key text check (
    roadmap_step_key is null or char_length(trim(roadmap_step_key)) between 1 and 80
  ),
  add column result_required boolean not null default false,
  add column completed_at timestamptz;

create index income_missions_path_status_idx
  on public.income_missions (income_path_id, status, sequence_order)
  where income_path_id is not null;

create table public.income_mission_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  income_mission_id uuid not null unique references public.income_missions(id) on delete cascade,
  outcome_data jsonb not null default '{}'::jsonb check (jsonb_typeof(outcome_data) = 'object'),
  notes text check (notes is null or char_length(notes) <= 2000),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_mission_results_user_recorded_idx
  on public.income_mission_results (user_id, recorded_at desc);

create trigger set_income_mission_results_updated_at
  before update on public.income_mission_results
  for each row execute function public.set_updated_at();

-- Evidence is additive to existing self-reported proficiency. No historical
-- user_skills row is rewritten or reinterpreted by this migration.
create table public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_skill_id uuid not null references public.user_skills(id) on delete cascade,
  income_path_id uuid references public.income_paths(id) on delete set null,
  income_mission_id uuid references public.income_missions(id) on delete set null,
  dimension text not null check (dimension in ('learning', 'action', 'outcome')),
  evidence_type text not null check (char_length(trim(evidence_type)) between 1 and 80),
  description text check (description is null or char_length(description) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index skill_evidence_user_skill_idx
  on public.skill_evidence (user_id, user_skill_id, occurred_at desc);
create index skill_evidence_path_idx
  on public.skill_evidence (income_path_id, occurred_at desc)
  where income_path_id is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.earn_assessments enable row level security;
alter table public.income_paths enable row level security;
alter table public.income_path_skills enable row level security;
alter table public.income_mission_results enable row level security;
alter table public.skill_evidence enable row level security;

-- Assessment snapshots are immutable at the application layer.
create policy "earn_assessments_select_own" on public.earn_assessments
  for select using (user_id = auth.uid());
create policy "earn_assessments_insert_own" on public.earn_assessments
  for insert with check (user_id = auth.uid());

create policy "income_paths_select_own" on public.income_paths
  for select using (user_id = auth.uid());
create policy "income_paths_insert_own" on public.income_paths
  for insert with check (user_id = auth.uid());
create policy "income_paths_update_own" on public.income_paths
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "income_paths_delete_own" on public.income_paths
  for delete using (user_id = auth.uid());

create policy "income_path_skills_select_own" on public.income_path_skills
  for select using (user_id = auth.uid());
create policy "income_path_skills_insert_own" on public.income_path_skills
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.user_skills s
      where s.id = user_skill_id and s.user_id = auth.uid()
    )
  );
create policy "income_path_skills_delete_own" on public.income_path_skills
  for delete using (user_id = auth.uid());

-- Replace the legacy policies so V2 missions cannot reference another user's
-- path. Null path IDs remain valid for all legacy rows.
drop policy "income_missions_insert_own" on public.income_missions;
drop policy "income_missions_update_own" on public.income_missions;
create policy "income_missions_insert_own" on public.income_missions
  for insert with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    ))
  );
create policy "income_missions_update_own" on public.income_missions
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    ))
  );

create policy "income_mission_results_select_own" on public.income_mission_results
  for select using (user_id = auth.uid());
create policy "income_mission_results_insert_own" on public.income_mission_results
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.income_missions m
      where m.id = income_mission_id and m.user_id = auth.uid()
    )
  );
create policy "income_mission_results_update_own" on public.income_mission_results
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.income_missions m
      where m.id = income_mission_id and m.user_id = auth.uid()
    )
  );
create policy "income_mission_results_delete_own" on public.income_mission_results
  for delete using (user_id = auth.uid());

create policy "skill_evidence_select_own" on public.skill_evidence
  for select using (user_id = auth.uid());
create policy "skill_evidence_insert_own" on public.skill_evidence
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_skills s
      where s.id = user_skill_id and s.user_id = auth.uid()
    )
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    ))
    and (income_mission_id is null or exists (
      select 1 from public.income_missions m
      where m.id = income_mission_id and m.user_id = auth.uid()
    ))
  );
create policy "skill_evidence_delete_own" on public.skill_evidence
  for delete using (user_id = auth.uid());
