import { describe, expect, it } from "vitest";

import {
  filterIncomeMissions,
  getIncomeMissionFilterCounts,
} from "@/lib/financial/income-mission-history";
import type { IncomeMission, MissionStatus } from "@/types/database";

function mission(id: string, status: MissionStatus, updatedAt: string): IncomeMission {
  return {
    id,
    user_id: "user-1",
    related_opportunity_id: null,
    title: id,
    description: null,
    mission_type: "other",
    target_quantity: null,
    progress_quantity: "0",
    status,
    sequence_order: 1,
    due_date: null,
    estimated_minutes: null,
    impact_level: "medium",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: updatedAt,
  };
}

const missions = [
  mission("not-started", "not_started", "2026-01-01T00:00:00.000Z"),
  mission("in-progress", "in_progress", "2026-01-02T00:00:00.000Z"),
  mission("completed-old", "completed", "2026-01-03T00:00:00.000Z"),
  mission("completed-new", "completed", "2026-01-05T00:00:00.000Z"),
  mission("skipped", "skipped", "2026-01-04T00:00:00.000Z"),
];

describe("income mission history filters", () => {
  it("counts active, completed, and all missions separately", () => {
    expect(getIncomeMissionFilterCounts(missions)).toEqual({ active: 2, completed: 2, all: 5 });
  });

  it("keeps only actionable missions in the active view", () => {
    expect(filterIncomeMissions(missions, "active").map((item) => item.id)).toEqual([
      "not-started",
      "in-progress",
    ]);
  });

  it("shows completed missions newest first and keeps skipped missions only in all", () => {
    expect(filterIncomeMissions(missions, "completed").map((item) => item.id)).toEqual([
      "completed-new",
      "completed-old",
    ]);
    expect(filterIncomeMissions(missions, "all")).toHaveLength(5);
  });
});
