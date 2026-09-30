import type { SkillEvidenceDimension } from "@/lib/earn/types";

/**
 * Skills V2 — progress from real evidence, not XP. A skill is described by
 * what the user has actually done with it:
 *   learning → studied it; action → used it in a real mission;
 *   outcome → using it produced a real result (a customer, an offer, a payment).
 * The level is the strongest dimension present; XP/Rank never feed it.
 */
export type SkillEvidenceLevel = "none" | "learning" | "action" | "outcome";

export interface SkillEvidenceRow {
  user_skill_id: string;
  dimension: SkillEvidenceDimension;
  occurred_at: string;
}

export interface SkillEvidenceSummary {
  counts: Record<SkillEvidenceDimension, number>;
  level: SkillEvidenceLevel;
  lastAt: string | null;
}

export function summarizeSkillEvidence(rows: SkillEvidenceRow[]): Map<string, SkillEvidenceSummary> {
  const out = new Map<string, SkillEvidenceSummary>();
  for (const row of rows) {
    const s = out.get(row.user_skill_id) ?? { counts: { learning: 0, action: 0, outcome: 0 }, level: "none" as SkillEvidenceLevel, lastAt: null };
    s.counts[row.dimension] += 1;
    if (!s.lastAt || row.occurred_at > s.lastAt) s.lastAt = row.occurred_at;
    out.set(row.user_skill_id, s);
  }
  for (const s of out.values()) {
    s.level = s.counts.outcome > 0 ? "outcome" : s.counts.action > 0 ? "action" : s.counts.learning > 0 ? "learning" : "none";
  }
  return out;
}

export const EMPTY_SKILL_EVIDENCE: SkillEvidenceSummary = { counts: { learning: 0, action: 0, outcome: 0 }, level: "none", lastAt: null };
