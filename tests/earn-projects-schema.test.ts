import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/0033_earn_mission_projects.sql"), "utf8");
const rlsFix = readFileSync(resolve("supabase/migrations/0034_fix_earn_mission_project_path_rls.sql"), "utf8");

describe("Earn mission-project migration contract", () => {
  it("is additive and leaves historical missions unassigned", () => {
    expect(migration).toContain("add column earn_project_id uuid");
    expect(migration).not.toMatch(/update public\.income_missions/i);
    expect(migration).not.toMatch(/drop table|truncate/i);
  });

  it("requires a project owned by the caller and explicitly compares it to the outer mission path", () => {
    expect(rlsFix).toMatch(/pr\.user_id = auth\.uid\(\)/);
    expect(rlsFix).toMatch(/pr\.income_path_id = income_missions\.income_path_id/);
    expect(rlsFix).not.toMatch(/pr\.income_path_id = income_path_id/);
  });

  it("uses safe deletion semantics", () => {
    expect(migration).toContain("references public.earn_projects(id) on delete set null");
  });
});
