import type { IncomeMission } from "@/types/database";

export type IncomeMissionHistoryFilter = "active" | "completed" | "all";

export function getIncomeMissionFilterCounts(missions: IncomeMission[]) {
  return {
    active: missions.filter((mission) => mission.status === "not_started" || mission.status === "in_progress").length,
    completed: missions.filter((mission) => mission.status === "completed").length,
    all: missions.length,
  };
}

export function filterIncomeMissions(
  missions: IncomeMission[],
  filter: IncomeMissionHistoryFilter
): IncomeMission[] {
  if (filter === "active") {
    return missions.filter((mission) => mission.status === "not_started" || mission.status === "in_progress");
  }

  if (filter === "completed") {
    return missions
      .filter((mission) => mission.status === "completed")
      .toSorted((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }

  return missions;
}
