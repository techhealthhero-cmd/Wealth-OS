-- Earn V2: optionally connect a path mission to one economic project.
-- Additive/backward-compatible: historical and legacy missions remain NULL.

alter table public.income_missions
  add column earn_project_id uuid references public.earn_projects(id) on delete set null;

create index income_missions_project_idx
  on public.income_missions (earn_project_id, status, created_at desc)
  where earn_project_id is not null;

-- Keep the existing path ownership checks and additionally require a linked
-- project to belong to the caller AND to the mission's selected path.
drop policy "income_missions_insert_own" on public.income_missions;
drop policy "income_missions_update_own" on public.income_missions;

create policy "income_missions_insert_own" on public.income_missions
  for insert with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    ))
    and (earn_project_id is null or exists (
      select 1 from public.earn_projects pr
      where pr.id = earn_project_id
        and pr.user_id = auth.uid()
        and pr.income_path_id = income_path_id
    ))
  );

create policy "income_missions_update_own" on public.income_missions
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_path_id and p.user_id = auth.uid()
    ))
    and (earn_project_id is null or exists (
      select 1 from public.earn_projects pr
      where pr.id = earn_project_id
        and pr.user_id = auth.uid()
        and pr.income_path_id = income_path_id
    ))
  );
