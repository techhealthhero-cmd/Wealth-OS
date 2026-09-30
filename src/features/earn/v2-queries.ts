import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { parseMoneyToCents } from "@/lib/financial/money";
import { deriveStageFacts, type DiagnosticAnswers } from "@/lib/earn/diagnostic";
import { calculateEarnStage } from "@/lib/earn/stage";
import { resolveNextAction } from "@/lib/earn/next-action";
import { recommendExperiments, type RecommendedExperiment } from "@/lib/earn/recommendations";
import { getMissionTemplate, resultHasPositiveOutcome } from "@/lib/earn/mission-templates";
import { getRoadmapProgress, type RoadmapProgress } from "@/lib/earn/roadmap";
import { diagnosticAnswersSchema } from "@/lib/validation/earn";
import type { EarnStageResult, IncomePathType, NextActionResult } from "@/lib/earn/types";
import type { EarnProject, IncomeMission, IncomePath } from "@/types/database";

/**
 * Earn V2 read side. Every figure is real data or a deterministic rule; no
 * LLM is involved. Money totals come ONLY from linked rows of the existing
 * `transactions` table — Earn has no ledger of its own.
 */

// PostgREST / Postgres codes for "table or function doesn't exist yet" —
// i.e. migration 0031 isn't applied on this database. Features built on it
// then degrade to "not available yet" instead of erroring the whole page.
const MISSING_RELATION = new Set(["42P01", "PGRST205", "42883", "PGRST202"]);
export function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_RELATION.has(error.code));
}

export interface LatestAssessment {
  id: string;
  answers: DiagnosticAnswers;
  storedStage: string;
  completedAt: string;
}

export const getLatestAssessment = cache(async (): Promise<LatestAssessment | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("earn_assessments")
    .select("id, answers, calculated_stage, completed_at")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // Older/foreign snapshots that don't fit the V2 shape are treated as "no
  // usable diagnostic" rather than guessed at.
  const parsed = diagnosticAnswersSchema.safeParse(data.answers);
  if (!parsed.success) return null;
  return { id: data.id, answers: parsed.data, storedStage: data.calculated_stage, completedAt: data.completed_at };
});

/** Emergency fund balance in minor units, or null when the user has none set up (unknown ≠ zero). */
export const getEmergencyFundMinor = cache(async (): Promise<number | null> => {
  const supabase = await createClient();
  const { data: fund } = await supabase
    .from("emergency_funds")
    .select("current_amount, linked_account_id")
    .maybeSingle();
  if (!fund) return null;
  if (fund.linked_account_id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("current_balance")
      .eq("id", fund.linked_account_id)
      .maybeSingle();
    if (account) return parseMoneyToCents(account.current_balance);
  }
  return parseMoneyToCents(fund.current_amount);
});

export const getIncomePaths = cache(async (): Promise<IncomePath[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("income_paths")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: true });
  return data ?? [];
});

export async function getIncomePath(pathId: string): Promise<IncomePath | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("income_paths").select("*").eq("id", pathId).maybeSingle();
  return data ?? null;
}

export interface PathMission extends IncomeMission {
  hasResult: boolean;
  resultCounts: Record<string, number> | null;
}

export async function getPathMissions(pathIds: string[]): Promise<PathMission[]> {
  if (pathIds.length === 0) return [];
  const supabase = await createClient();
  const { data: missions } = await supabase
    .from("income_missions")
    .select("*")
    .in("income_path_id", pathIds)
    .order("sequence_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!missions?.length) return [];
  const { data: results } = await supabase
    .from("income_mission_results")
    .select("income_mission_id, outcome_data")
    .in("income_mission_id", missions.map((m) => m.id));
  const byMission = new Map((results ?? []).map((r) => [r.income_mission_id, r.outcome_data]));
  return missions.map((m) => {
    const outcome = byMission.get(m.id) as { counts?: Record<string, number> } | undefined;
    return { ...m, hasResult: byMission.has(m.id), resultCounts: outcome?.counts ?? null };
  });
}

export interface PathIncome {
  available: boolean;
  /** Per currency — never summed across currencies. */
  totals: { currency: string; amountMinor: number }[];
  byPath: Record<string, { currency: string; amountMinor: number }[]>;
  linkCount: number;
}

/** Income linked to Earn paths, read from the real transactions it points at. */
export async function getLinkedIncome(pathIds: string[]): Promise<PathIncome> {
  const empty: PathIncome = { available: true, totals: [], byPath: {}, linkCount: 0 };
  if (pathIds.length === 0) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("earn_transaction_links")
    .select("income_path_id, transaction:transactions!earn_transaction_links_transaction_id_fkey(amount, currency_code, type)")
    .in("income_path_id", pathIds);
  if (error) return isMissingRelation(error) ? { ...empty, available: false } : empty;

  const add = (list: { currency: string; amountMinor: number }[], currency: string, minor: number) => {
    const row = list.find((r) => r.currency === currency);
    if (row) row.amountMinor += minor;
    else list.push({ currency, amountMinor: minor });
  };
  const result: PathIncome = { available: true, totals: [], byPath: {}, linkCount: 0 };
  for (const row of data ?? []) {
    const tx = (Array.isArray(row.transaction) ? row.transaction[0] : row.transaction) as
      | { amount: string; currency_code: string; type: string }
      | null;
    if (!tx || tx.type !== "income") continue;
    const minor = parseMoneyToCents(tx.amount);
    add(result.totals, tx.currency_code, minor);
    add((result.byPath[row.income_path_id] ??= []), tx.currency_code, minor);
    result.linkCount += 1;
  }
  return result;
}

export interface ProjectsResult {
  available: boolean;
  projects: EarnProject[];
}

export async function getEarnProjects(pathId: string): Promise<ProjectsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("earn_projects")
    .select("*")
    .eq("income_path_id", pathId)
    .neq("status", "archived")
    .order("created_at", { ascending: true });
  if (error) return { available: !isMissingRelation(error), projects: [] };
  return { available: true, projects: data ?? [] };
}

export interface HubPath {
  path: IncomePath;
  progress: RoadmapProgress;
  currentMission: PathMission | null;
}

export interface EarnHubData {
  assessment: LatestAssessment | null;
  stage: EarnStageResult;
  paths: HubPath[];
  nextAction: NextActionResult;
  recommendations: RecommendedExperiment[];
  income: PathIncome;
  /** Titles of live missions, so the Hub can headline the concrete mission. */
  missionTitles: Record<string, string>;
}

/** A path's current mission: the open mission on its current roadmap step, else the latest open one. */
function currentMissionFor(path: IncomePath, missions: PathMission[]): PathMission | null {
  const mine = missions.filter((m) => m.income_path_id === path.id);
  const open = mine.filter((m) => m.status !== "completed" && m.status !== "skipped");
  return (
    open.find((m) => m.roadmap_step_key === path.current_roadmap_step_key) ??
    open[open.length - 1] ??
    mine.find((m) => m.result_required && m.status === "completed" && !m.hasResult) ??
    null
  );
}

/**
 * Everything the Earn Hub needs in one pass: live (recomputed, not the
 * stored snapshot) Earn stage, paths with roadmap progress, and the single
 * deterministic Next Action.
 */
export async function getEarnHubData(): Promise<EarnHubData> {
  const [assessment, fundMinor, paths] = await Promise.all([getLatestAssessment(), getEmergencyFundMinor(), getIncomePaths()]);
  const stage = assessment
    ? calculateEarnStage(deriveStageFacts(assessment.answers, fundMinor))
    : calculateEarnStage({
        hasCompletedAssessment: false, monthlyIncome: null, essentialExpenses: null, incomeReliability: null,
        bufferMonths: null, hasRepeatableIncomeMechanism: false, hasFinancialIndependenceEvidence: false,
      });

  const livePaths = paths.filter((p) => p.status === "active" || p.status === "planned");
  const [missions, income] = await Promise.all([getPathMissions(paths.map((p) => p.id)), getLinkedIncome(paths.map((p) => p.id))]);

  const hubPaths: HubPath[] = paths.map((path) => ({
    path,
    progress: getRoadmapProgress(path.path_type as IncomePathType, path.current_roadmap_step_key, path.status === "completed"),
    currentMission: currentMissionFor(path, missions),
  }));

  const liveIds = new Set(livePaths.map((p) => p.id));
  const liveMissions = missions.filter((m) => m.income_path_id && liveIds.has(m.income_path_id));
  const pendingResults = liveMissions
    .filter((m) => m.result_required && m.status === "completed" && !m.hasResult)
    .map((m) => ({ id: m.id, pathId: m.income_path_id, estimatedMinutes: m.estimated_minutes, resultRequired: true as const, hasResult: false as const }));
  const activeMissions = liveMissions
    .filter((m) => m.status === "not_started" || m.status === "in_progress")
    .map((m) => ({ id: m.id, pathId: m.income_path_id, estimatedMinutes: m.estimated_minutes }));

  // "Money may have arrived but isn't recorded": a positive result on an
  // income-producing step, on a path with no linked income yet. Only when
  // income links exist on this database (else we can't know).
  const unrecordedIncome = income.available
    ? livePaths
        .filter((p) => !(income.byPath[p.id]?.length))
        .filter((p) =>
          liveMissions.some((m) => {
            if (m.income_path_id !== p.id || !m.hasResult || !m.roadmap_step_key) return false;
            const t = getMissionTemplate(p.path_type as IncomePathType, m.roadmap_step_key);
            return Boolean(t?.mayProduceIncome && m.resultCounts && resultHasPositiveOutcome(t, m.resultCounts));
          })
        )
        .map((p) => ({ pathId: p.id }))
    : [];

  const nextAction = resolveNextAction({
    assessmentStatus: assessment ? "completed" : "not_started",
    stage,
    activePaths: livePaths.map((p) => ({ id: p.id, status: p.status, initialized: Boolean(p.initialized_at) })),
    pendingMissionResults: pendingResults,
    activeMissions,
    unrecordedIncome,
  });

  return {
    assessment,
    stage,
    paths: hubPaths,
    nextAction,
    recommendations: assessment ? recommendExperiments(assessment.answers, stage.stage) : [],
    income,
    missionTitles: Object.fromEntries(liveMissions.map((m) => [m.id, m.title])),
  };
}
