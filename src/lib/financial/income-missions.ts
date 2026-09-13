/**
 * Income Mission generation — deterministic templates only (Day 5 STEP 9/10).
 * A mission's title/description are resolved by the caller from
 * `mission_type` via i18n (`earn.missions.templates.<type>.*`) — this module
 * never returns display text, only structured, testable sequencing data.
 * AI may reword an explanation of a mission but never invents one, and
 * never marks progress on the user's behalf.
 */

import type { MissionType, ImpactLevel } from "@/types/database";

export interface MissionTemplate {
  missionType: MissionType;
  sequenceOrder: number;
  targetQuantity: number | null;
  estimatedMinutes: number | null;
  impactLevel: ImpactLevel;
}

/**
 * One canonical sequence, applicable to any opportunity — turning "start a
 * side hustle" into the same concrete, ordered steps CLAUDE.md's EARN SYSTEM
 * example names (offer → portfolio → profile → price → publish → outreach →
 * follow-up → first client), plus two evergreen growth steps once a first
 * client exists.
 */
const CANONICAL_SEQUENCE: MissionTemplate[] = [
  { missionType: "define_offer", sequenceOrder: 1, targetQuantity: null, estimatedMinutes: 30, impactLevel: "high" },
  { missionType: "build_portfolio", sequenceOrder: 2, targetQuantity: 1, estimatedMinutes: 120, impactLevel: "medium" },
  { missionType: "create_profile", sequenceOrder: 3, targetQuantity: 1, estimatedMinutes: 45, impactLevel: "medium" },
  { missionType: "set_price", sequenceOrder: 4, targetQuantity: null, estimatedMinutes: 20, impactLevel: "medium" },
  { missionType: "publish_offer", sequenceOrder: 5, targetQuantity: 1, estimatedMinutes: 30, impactLevel: "high" },
  { missionType: "outreach", sequenceOrder: 6, targetQuantity: 5, estimatedMinutes: 60, impactLevel: "high" },
  { missionType: "follow_up", sequenceOrder: 7, targetQuantity: 5, estimatedMinutes: 30, impactLevel: "medium" },
  { missionType: "close_client", sequenceOrder: 8, targetQuantity: 1, estimatedMinutes: null, impactLevel: "high" },
  { missionType: "ask_referral", sequenceOrder: 9, targetQuantity: 1, estimatedMinutes: 15, impactLevel: "low" },
  { missionType: "raise_price", sequenceOrder: 10, targetQuantity: null, estimatedMinutes: 15, impactLevel: "low" },
];

/** Returns the full deterministic mission sequence for a chosen opportunity. */
export function generateMissionSequence(): MissionTemplate[] {
  return CANONICAL_SEQUENCE.map((template) => ({ ...template }));
}

export interface MissionProgressCounts {
  total: number;
  completed: number;
  inProgress: number;
  skipped: number;
  notStarted: number;
}

export function summarizeMissionStatuses(
  statuses: Array<"not_started" | "in_progress" | "completed" | "skipped">
): MissionProgressCounts {
  return {
    total: statuses.length,
    completed: statuses.filter((s) => s === "completed").length,
    inProgress: statuses.filter((s) => s === "in_progress").length,
    skipped: statuses.filter((s) => s === "skipped").length,
    notStarted: statuses.filter((s) => s === "not_started").length,
  };
}
