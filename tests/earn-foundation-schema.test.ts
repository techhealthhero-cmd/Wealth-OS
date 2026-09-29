import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/0028_earn_foundation.sql"), "utf8");

describe("Earn foundation migration contract", () => {
  it("keeps reassessments as immutable history", () => {
    expect(migration).toContain("create table public.earn_assessments");
    expect(migration).not.toContain("user_id uuid not null unique references auth.users");
    expect(migration).not.toContain('policy "earn_assessments_update_own"');
  });

  it("leaves legacy missions valid while separating result recording", () => {
    expect(migration).toContain("add column result_required boolean not null default false");
    expect(migration).toContain("create table public.income_mission_results");
    expect(migration).not.toMatch(/update public\.income_missions[\s\S]+result_required/i);
  });

  it("rejects cross-user path, skill and mission references through RLS checks", () => {
    expect(migration).toMatch(/p\.id = income_path_id and p\.user_id = auth\.uid\(\)/);
    expect(migration).toMatch(/s\.id = user_skill_id and s\.user_id = auth\.uid\(\)/);
    expect(migration).toMatch(/m\.id = income_mission_id and m\.user_id = auth\.uid\(\)/);
  });

  it("does not create an Earn ledger or roadmap stages table", () => {
    expect(migration).not.toContain("create table public.earn_transactions");
    expect(migration).not.toContain("create table public.roadmap_stages");
  });
});
