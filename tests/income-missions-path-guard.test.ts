import { beforeEach, describe, expect, it, vi } from "vitest";

import { incrementMissionProgress, updateMissionStatus } from "@/features/income-missions/actions";
import { completeEarnMission } from "@/features/earn/v2-actions";

/**
 * Regression (Earn V2 audit P0-1): the legacy Missions tab listed Earn V2
 * path missions and its actions could complete/skip them, bypassing result
 * recording and roadmap progression and stranding the path. The legacy
 * actions must refuse path missions server-side, and the V2 action must
 * refuse legacy missions.
 */

type Row = Record<string, unknown>;
let db: Record<string, Row[]>;
let currentUser: { id: string } | null;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: "select" | "update" | "insert" = "select";
  private payload: Row | null = null;
  constructor(private table: string) {}
  select() { return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  insert(p: Row) { this.op = "insert"; this.payload = p; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  order() { return this; }
  limit() { return this; }
  private run() {
    const rows = (db[this.table] ??= []);
    if (this.op === "insert") { rows.push({ id: crypto.randomUUID(), ...this.payload! }); return { data: null, error: null }; }
    const matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") matched.forEach((r) => Object.assign(r, this.payload));
    return { data: matched, error: null };
  }
  maybeSingle() { const { data } = this.run(); return Promise.resolve({ data: data?.[0] ?? null, error: null }); }
  single() { return this.maybeSingle(); }
  then(f: (r: { data: Row[] | null; error: unknown }) => unknown) { return Promise.resolve(f(this.run())); }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser } }) }, from: (t: string) => new Query(t) }),
}));
vi.mock("@/features/profile/queries", () => ({ getProfile: async () => null }));
vi.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const awardXpOnce = vi.fn(async () => true);
vi.mock("@/features/engagement/xp", () => ({ awardXpOnce: (...a: unknown[]) => awardXpOnce(...(a as [])) }));

const PATH_MISSION = { id: "pm", user_id: "u1", mission_type: "other", income_path_id: "path-1", roadmap_step_key: "find_leads", result_required: true, status: "not_started", progress_quantity: 0 };
const LEGACY_MISSION = { id: "lm", user_id: "u1", mission_type: "outreach", income_path_id: null, status: "not_started", progress_quantity: 0 };

beforeEach(() => {
  currentUser = { id: "u1" };
  db = { income_missions: [{ ...PATH_MISSION }, { ...LEGACY_MISSION }] };
  awardXpOnce.mockClear();
});

const row = (id: string) => db.income_missions.find((m) => m.id === id)!;

describe("legacy mission actions refuse Earn V2 path missions", () => {
  it.each(["completed", "skipped", "in_progress", "not_started"] as const)("updateMissionStatus(%s) on a path mission is rejected and changes nothing", async (status) => {
    const res = await updateMissionStatus("pm", status);
    expect(res.error).toBeTruthy();
    expect(row("pm").status).toBe("not_started");
    expect(awardXpOnce).not.toHaveBeenCalled();
  });

  it("incrementMissionProgress on a path mission is rejected (it could auto-complete it)", async () => {
    const res = await incrementMissionProgress("pm", 1);
    expect(res.error).toBeTruthy();
    expect(row("pm")).toMatchObject({ status: "not_started", progress_quantity: 0 });
  });

  it("legacy missions keep working exactly as before", async () => {
    expect((await updateMissionStatus("lm", "completed")).success).toBe(true);
    expect(row("lm").status).toBe("completed");
    expect(awardXpOnce).toHaveBeenCalledTimes(1);
  });
});

describe("Earn V2 completion refuses legacy missions", () => {
  it("completeEarnMission on a legacy mission is rejected", async () => {
    const res = await completeEarnMission("lm");
    expect(res.error).toBeTruthy();
    expect(row("lm").status).toBe("not_started");
  });

  it("a result-required path mission completed through V2 waits for its result (roadmap does not move)", async () => {
    db.income_paths = [{ id: "path-1", user_id: "u1", path_type: "freelance_service", current_roadmap_step_key: "find_leads" }];
    await completeEarnMission("pm");
    expect(row("pm").status).toBe("completed");
    expect(db.income_paths[0].current_roadmap_step_key).toBe("find_leads");
  });
});
