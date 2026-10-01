-- Earn V2: qualify the outer mission path in project ownership policies.
--
-- Migration 0033 used an unqualified `income_path_id` inside the
-- earn_projects subquery. PostgreSQL resolved that name to
-- earn_projects.income_path_id, making the same-path comparison tautological.
-- Replacing the policies keeps the schema additive while restoring the
-- intended server-side same-user AND same-path invariant.

drop policy "income_missions_insert_own" on public.income_missions;
drop policy "income_missions_update_own" on public.income_missions;

create policy "income_missions_insert_own" on public.income_missions
  for insert with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_missions.income_path_id
        and p.user_id = auth.uid()
    ))
    and (earn_project_id is null or exists (
      select 1 from public.earn_projects pr
      where pr.id = income_missions.earn_project_id
        and pr.user_id = auth.uid()
        and pr.income_path_id = income_missions.income_path_id
    ))
  );

create policy "income_missions_update_own" on public.income_missions
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (income_path_id is null or exists (
      select 1 from public.income_paths p
      where p.id = income_missions.income_path_id
        and p.user_id = auth.uid()
    ))
    and (earn_project_id is null or exists (
      select 1 from public.earn_projects pr
      where pr.id = income_missions.earn_project_id
        and pr.user_id = auth.uid()
        and pr.income_path_id = income_missions.income_path_id
    ))
  );
