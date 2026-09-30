import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeEarnMission,
  createEarnProject,
  createIncomePath,
  recordEarnIncome,
  recordEarnMissionResult,
  submitDiagnostic,
} from "@/features/earn/v2-actions";
import type { DiagnosticAnswers } from "@/lib/earn/diagnostic";

/**
 * Earn V2 server actions against an in-memory Supabase fake (never a real
 * database). `migrated0031 = false` simulates a database without the
 * projects/income-link migration: those relations report "does not exist".
 */

type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let currentUser: { id: string } | null;
let migrated0031: boolean;
let rpcCalls: { fn: string; args: Row }[];

const MIGRATION_0031 = new Set(["earn_projects", "earn_transaction_links"]);

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row | null = null;
  private conflict: string | null = null;
  private limitN = Infinity;
  constructor(private table: string) {}
  select() { return this; }
  insert(p: Row) { this.op = "insert"; this.payload = p; return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row, o?: { onConflict?: string }) { this.op = "upsert"; this.payload = p; this.conflict = o?.onConflict ?? null; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  order() { return this; }
  limit(n: number) { this.limitN = n; return this; }
  private rows() { return (db[this.table] ??= []); }
  private run(): { data: Row[] | null; error: { code: string; message: string } | null } {
    if (!migrated0031 && MIGRATION_0031.has(this.table)) return { data: null, error: { code: "42P01", message: "relation does not exist" } };
    if (this.op === "insert") {
      const row = { id: crypto.randomUUID(), ...this.payload! };
      this.rows().push(row);
      return { data: [row], error: null };
    }
    if (this.op === "upsert") {
      const key = this.conflict!;
      const existing = this.rows().find((r) => r[key] === this.payload![key]);
      if (existing) Object.assign(existing, this.payload);
      else this.rows().push({ id: crypto.randomUUID(), ...this.payload! });
      return { data: null, error: null };
    }
    const matched = this.rows().filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.payload));
    return { data: matched.slice(0, this.limitN), error: null };
  }
  single() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error: error ?? (data?.[0] ? null : { code: "PGRST116", message: "no rows" }) });
  }
  maybeSingle() {
    const { data, error } = this.run();
    return Promise.resolve({ data: data?.[0] ?? null, error });
  }
  then(onfulfilled: (r: { data: Row[] | null; error: unknown }) => unknown) {
    return Promise.resolve(onfulfilled(this.run()));
  }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args: Row) => {
      rpcCalls.push({ fn, args });
      if (!migrated0031) return { data: null, error: { code: "PGRST202", message: "function not found" } };
      return { data: "tx-1", error: null };
    },
  }),
}));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => null }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/engagement/xp", () => ({ awardXpOnce: vi.fn(async () => true) }));

const ANSWERS: DiagnosticAnswers = {
  incomeSituation: "none",
  monthlyIncomeMinor: 0,
  incomeIsSteady: null,
  essentialExpensesMinor: 1_200_000,
  availableResources: ["smartphone", "computer"],
  workPreferences: ["digital"],
  existingAbilities: ["design"],
  availableHoursPerWeek: 8,
  startingCapitalMinor: 0,
  startingCapitalCurrency: "THB",
  currentPriority: "quick_money",
};

beforeEach(() => {
  db = {};
  currentUser = { id: "user-1" };
  migrated0031 = true;
  rpcCalls = [];
});

const missionsOf = (pathId: string) => (db.income_missions ?? []).filter((m) => m.income_path_id === pathId);
const pathRow = (id: string) => db.income_paths.find((p) => p.id === id)!;

describe("submitDiagnostic", () => {
  it("stores an immutable snapshot with a server-computed stage", async () => {
    const res = await submitDiagnostic(ANSWERS);
    expect(res.success).toBe(true);
    expect(db.earn_assessments).toHaveLength(1);
    expect(db.earn_assessments[0]).toMatchObject({
      user_id: "user-1",
      calculated_stage: "survive",
      reason_codes: ["no_income_for_basic_needs"],
      essential_expenses_amount: 12000,
      essential_expenses_source: "self_report",
    });
  });

  it("reassessment adds a new snapshot, never overwrites", async () => {
    await submitDiagnostic(ANSWERS);
    await submitDiagnostic({ ...ANSWERS, incomeSituation: "salary", monthlyIncomeMinor: 3_000_000 });
    expect(db.earn_assessments.map((a) => a.calculated_stage)).toEqual(["survive", "stability"]);
  });

  it("rejects invalid answers and anonymous users", async () => {
    expect((await submitDiagnostic({ ...ANSWERS, essentialExpensesMinor: 0 })).error).toBeTruthy();
    currentUser = null;
    expect((await submitDiagnostic(ANSWERS)).error).toBeTruthy();
    expect(db.earn_assessments ?? []).toHaveLength(0);
  });
});

describe("paths, roadmap and missions", () => {
  it("creating a path initializes the roadmap at step one with its first mission", async () => {
    const res = await createIncomePath({ pathType: "freelance_service", title: "Website jobs" });
    const path = pathRow(res.id!);
    expect(path).toMatchObject({ user_id: "user-1", status: "active", current_roadmap_step_key: "foundation" });
    expect(path.initialized_at).toBeTruthy();
    expect(missionsOf(res.id!)).toEqual([
      expect.objectContaining({ roadmap_step_key: "foundation", mission_category: "learn", result_required: false, mission_type: "other", status: "not_started" }),
    ]);
  });

  it("completing a no-result mission advances exactly one step and opens the next mission", async () => {
    const { id } = await createIncomePath({ pathType: "freelance_service", title: "Web" });
    const first = missionsOf(id!)[0];
    await completeEarnMission(first.id as string);
    expect(pathRow(id!).current_roadmap_step_key).toBe("proof_of_work");
    // a repeated completion never jumps a second step
    await completeEarnMission(first.id as string);
    expect(pathRow(id!).current_roadmap_step_key).toBe("proof_of_work");
    expect(missionsOf(id!).filter((m) => m.roadmap_step_key === "proof_of_work")).toHaveLength(1);
  });

  it("a result-required mission waits for its result before the roadmap moves", async () => {
    const { id } = await createIncomePath({ pathType: "freelance_service", title: "Web" });
    await completeEarnMission(missionsOf(id!)[0].id as string); // foundation → proof_of_work
    const proof = missionsOf(id!).find((m) => m.roadmap_step_key === "proof_of_work")!;
    await completeEarnMission(proof.id as string);
    expect(pathRow(id!).current_roadmap_step_key).toBe("proof_of_work");
    const res = await recordEarnMissionResult({ missionId: proof.id as string, counts: { samples: 1 }, decision: "continue", notes: "Built one landing page" });
    expect(res.success).toBe(true);
    expect(db.income_mission_results[0]).toMatchObject({ income_mission_id: proof.id, notes: "Built one landing page" });
    expect(pathRow(id!).current_roadmap_step_key).toBe("find_leads");
  });

  it("rejects a result whose funnel widens, and stores nothing", async () => {
    const { id } = await createIncomePath({ pathType: "freelance_service", title: "Web" });
    db.income_missions.push({ id: "aaaaaaaa-0000-4000-8000-000000000001", user_id: "user-1", income_path_id: id, roadmap_step_key: "find_leads", status: "completed", mission_type: "other" });
    const res = await recordEarnMissionResult({ missionId: "aaaaaaaa-0000-4000-8000-000000000001", counts: { contacted: 2, responses: 5 }, decision: "continue", notes: null });
    expect(res.error).toBeTruthy();
    expect(db.income_mission_results ?? []).toHaveLength(0);
  });

  it("adjust = a fresh try of the same step; pause/switch pause the path", async () => {
    const { id } = await createIncomePath({ pathType: "freelance_service", title: "Web" });
    pathRow(id!).current_roadmap_step_key = "find_leads";
    db.income_missions.push({ id: "aaaaaaaa-0000-4000-8000-000000000002", user_id: "user-1", income_path_id: id, roadmap_step_key: "find_leads", status: "completed", mission_type: "other" });
    await recordEarnMissionResult({ missionId: "aaaaaaaa-0000-4000-8000-000000000002", counts: { contacted: 5, responses: 0, interested: 0 }, decision: "adjust", notes: null });
    expect(pathRow(id!).current_roadmap_step_key).toBe("find_leads");
    expect(missionsOf(id!).filter((m) => m.roadmap_step_key === "find_leads" && m.status === "not_started")).toHaveLength(1);

    db.income_missions.push({ id: "aaaaaaaa-0000-4000-8000-000000000003", user_id: "user-1", income_path_id: id, roadmap_step_key: "find_leads", status: "completed", mission_type: "other" });
    await recordEarnMissionResult({ missionId: "aaaaaaaa-0000-4000-8000-000000000003", counts: { contacted: 5 }, decision: "pause", notes: null });
    expect(pathRow(id!).status).toBe("paused");
  });

  it("skill evidence: outcome when the funnel's last stage > 0, else action", async () => {
    const { id } = await createIncomePath({ pathType: "freelance_service", title: "Web" });
    pathRow(id!).current_roadmap_step_key = "find_leads";
    db.income_missions.push({ id: "aaaaaaaa-0000-4000-8000-000000000002", user_id: "user-1", income_path_id: id, roadmap_step_key: "find_leads", status: "completed", mission_type: "other" });
    const SKILL = "55555555-5555-4555-8555-555555555555";
    await recordEarnMissionResult({ missionId: "aaaaaaaa-0000-4000-8000-000000000002", counts: { contacted: 5, responses: 2, interested: 1 }, decision: "continue", notes: null, skillId: SKILL });
    expect(db.skill_evidence[0]).toMatchObject({ user_skill_id: SKILL, dimension: "outcome", income_mission_id: "aaaaaaaa-0000-4000-8000-000000000002", income_path_id: id });
  });

  it("cannot act on another user's mission", async () => {
    db.income_missions = [{ id: "theirs", user_id: "user-2", income_path_id: "p2", roadmap_step_key: "foundation", status: "not_started", mission_type: "other" }];
    expect((await completeEarnMission("theirs")).error).toBeTruthy();
    expect(db.income_missions[0].status).toBe("not_started");
    expect((await recordEarnMissionResult({ missionId: "11111111-1111-4111-8111-111111111111", counts: {}, decision: null, notes: null })).error).toBeTruthy();
  });

  it("investment paths are planning-only: no money outcomes", async () => {
    const { id } = await createIncomePath({ pathType: "investment", title: "Long-term plan" });
    expect(missionsOf(id!)[0]).toMatchObject({ roadmap_step_key: "foundation", result_required: false });
  });
});

describe("real income goes through the existing ledger (record_earn_income)", () => {
  const INPUT = {
    pathId: "path-1",
    projectId: null,
    accountId: "acc-1",
    categoryId: null,
    amountCents: 350_000,
    date: "2026-09-01",
    description: "Website deposit",
    clientRequestId: "3f0c7b2e-6a1d-4f8e-9c3b-1a2b3c4d5e6f",
  };

  it("calls the atomic RPC with decimal amount and the idempotency key", async () => {
    const res = await recordEarnIncome(INPUT);
    expect(res.success).toBe(true);
    expect(rpcCalls).toEqual([
      {
        fn: "record_earn_income",
        args: expect.objectContaining({ p_income_path_id: "path-1", p_amount: 3500, p_client_request_id: INPUT.clientRequestId, p_account_id: "acc-1" }),
      },
    ]);
    // Earn itself never writes money rows.
    expect(db.transactions ?? []).toHaveLength(0);
  });

  it("rejects bad amounts, future dates and non-income categories before touching the database", async () => {
    expect((await recordEarnIncome({ ...INPUT, amountCents: 0 })).error).toBeTruthy();
    expect((await recordEarnIncome({ ...INPUT, date: "2999-01-01" })).error).toBeTruthy();
    db.categories = [{ id: "cat-food", type: "expense" }];
    expect((await recordEarnIncome({ ...INPUT, categoryId: "cat-food" })).error).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
  });

  it("explains a pending migration instead of failing obscurely", async () => {
    migrated0031 = false;
    expect((await recordEarnIncome(INPUT)).error).toMatch(/0031/);
    expect((await createEarnProject({ pathId: "path-1", title: "ABC website" })).error).toMatch(/0031/);
  });
});
