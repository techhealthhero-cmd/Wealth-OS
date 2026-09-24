import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUpcomingBills } from "@/features/recurring/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getPendingSubscriptions } from "@/features/subscriptions/queries";
import { getGoals } from "@/features/goals/queries";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getTransactions } from "@/features/transactions/queries";
import { getProfile } from "@/features/profile/queries";
import { getLifeStageAndPriorities } from "@/features/life-stage/queries";
import { buildNextBestActionText } from "@/features/ai/lib/next-best-action";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { calculateDebtReductionContributions } from "@/lib/financial/calculations";
import { calculateGoalProgress } from "@/lib/financial/goals";
import { parseMoneyToCents, formatMoney } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import type { NotificationPreferences, NotificationType } from "@/types/database";

interface NotificationDraft {
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  relatedId?: string;
}

function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Minimal server-side counterpart to i18n/client.tsx's useTranslation() —
 * that one is a client hook (can't be imported here), and
 * buildNextBestActionText() just needs a plain `(key) => string` dot-path
 * lookup, the same contract the client version provides.
 */
function translate(dict: Dictionary, key: string): string {
  const value = key.split(".").reduce<unknown>((node, segment) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Record<string, unknown>)[segment];
  }, dict);
  return typeof value === "string" ? value : key;
}

/**
 * Generates any newly-true notification conditions. Deduplication is
 * enforced by the database itself (`unique(user_id, dedupe_key)`) — a
 * duplicate insert is simply ignored, never a bookkeeping check that could
 * be gotten wrong in a new code path. Called on-demand (dashboard/
 * notifications page load) since this app has no background job runner.
 *
 * `title`/`body` are plain display text, composed here in the user's own
 * locale — never a raw i18n key or machine enum value, since
 * `financial_notifications` rows are rendered directly with no further
 * translation lookup at read time.
 */
export async function syncNotifications(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const { data: prefsRow } = await supabase.from("notification_preferences").select("*").maybeSingle();
  const prefs: Partial<NotificationPreferences> = prefsRow ?? {};
  const enabled = (category: keyof NotificationPreferences) => prefs[category] !== false;

  const drafts: NotificationDraft[] = [];
  const now = new Date();

  if (enabled("upcoming_bill")) {
    const bills = await getUpcomingBills();
    for (const bill of [...bills.overdue, ...bills.next7Days]) {
      drafts.push({
        type: "upcoming_bill",
        title: dict.notifications.categories.upcoming_bill,
        body: `${bill.label} — ${formatMoney(bill.amountCents)} (${bill.dueDate})`,
        dedupeKey: `upcoming_bill:${bill.source}:${bill.id}:${bill.dueDate}`,
        relatedId: bill.id,
      });
    }
  }

  if (enabled("budget_near_limit") || enabled("budget_exceeded")) {
    const budget = await getBudgetSummary();
    if (budget?.overall.status === "over_budget" && enabled("budget_exceeded")) {
      drafts.push({
        type: "budget_exceeded",
        title: dict.notifications.categories.budget_exceeded,
        body: `${budget.overall.percentUsed.toFixed(0)}%`,
        dedupeKey: `budget_exceeded:${monthKey()}`,
      });
    } else if (budget?.overall.status === "near_limit" && enabled("budget_near_limit")) {
      drafts.push({
        type: "budget_near_limit",
        title: dict.notifications.categories.budget_near_limit,
        body: `${budget.overall.percentUsed.toFixed(0)}%`,
        dedupeKey: `budget_near_limit:${monthKey()}`,
      });
    }
  }

  if (enabled("subscription_detected")) {
    const pending = await getPendingSubscriptions();
    for (const sub of pending) {
      drafts.push({
        type: "subscription_detected",
        title: dict.notifications.categories.subscription_detected,
        body: `${sub.merchant} — ${formatMoney(parseMoneyToCents(sub.estimated_amount))}`,
        dedupeKey: `subscription_detected:${sub.id}`,
        relatedId: sub.id,
      });
    }
  }

  if (enabled("goal_milestone")) {
    const goals = await getGoals();
    for (const g of goals.filter((g) => g.status === "active")) {
      const progress = calculateGoalProgress(parseMoneyToCents(g.current_amount), parseMoneyToCents(g.target_amount));
      if (progress >= 100) {
        drafts.push({
          type: "goal_milestone",
          title: dict.notifications.categories.goal_milestone,
          body: g.name,
          dedupeKey: `goal_milestone:${g.id}:achieved`,
          relatedId: g.id,
        });
      }
    }
  }

  if (enabled("emergency_fund_milestone")) {
    const [fund, essential] = await Promise.all([getEmergencyFund(), getEssentialMonthlyExpenses()]);
    if (fund) {
      const monthsProtected = calculateMonthsProtected(parseMoneyToCents(fund.current_amount), essential.cents);
      const targetMonths = fund.target_months ? Number(fund.target_months) : 6;
      if (monthsProtected >= targetMonths) {
        drafts.push({
          type: "emergency_fund_milestone",
          title: dict.notifications.categories.emergency_fund_milestone,
          body: `${targetMonths}`,
          dedupeKey: `emergency_fund_milestone:${monthKey()}:achieved`,
        });
      }
    }
  }

  if (enabled("debt_milestone")) {
    const from = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = toLocalDateString(now);
    const currentMonthTx = await getTransactions({ from, to, type: "debt_payment" });
    const debtPaidCents = calculateDebtReductionContributions(currentMonthTx);
    if (debtPaidCents > 0) {
      drafts.push({
        type: "debt_milestone",
        title: dict.notifications.categories.debt_milestone,
        body: formatMoney(debtPaidCents),
        dedupeKey: `debt_milestone:${monthKey()}`,
      });
    }
  }

  if (enabled("monthly_review_due")) {
    const dayOfMonth = now.getDate();
    if (dayOfMonth >= 3) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { data: prevReview } = await supabase
        .from("monthly_reviews")
        .select("completed_at")
        .eq("year", prevMonth.getFullYear())
        .eq("month", prevMonth.getMonth() + 1)
        .maybeSingle();
      if (!prevReview?.completed_at) {
        drafts.push({
          type: "monthly_review_due",
          title: dict.notifications.categories.monthly_review_due,
          body: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`,
          dedupeKey: `monthly_review_due:${prevMonth.getFullYear()}-${prevMonth.getMonth() + 1}`,
        });
      }
    }
  }

  if (enabled("mission_reminder")) {
    const { data: highImpactMissions } = await supabase
      .from("wealth_missions")
      .select("id, title")
      .eq("status", "not_started")
      .eq("impact_level", "high")
      .limit(1);
    if (highImpactMissions && highImpactMissions.length > 0) {
      const missionTemplateKey = highImpactMissions[0].title;
      const missionTitle = (dict.missions.templates as Record<string, { title: string }>)[missionTemplateKey]?.title ?? missionTemplateKey;
      drafts.push({
        type: "mission_reminder",
        title: dict.notifications.categories.mission_reminder,
        body: missionTitle,
        dedupeKey: `mission_reminder:${monthKey()}`,
        relatedId: highImpactMissions[0].id,
      });
    }
  }

  // The app's own Next Best Action Engine (priority-engine.ts) already
  // ranks negative cash flow, an underfunded emergency fund, high-interest
  // debt, a goal falling behind, an income gap, a low savings rate, weak
  // income growth, and no investment activity — CLAUDE.md's documented
  // "what is the next best financial action for this user?" core loop —
  // but until now it only ever showed up on the dashboard's
  // NextBestActionCard, never as something a user could come back to here.
  // Reuses that exact computation and copy (getLifeStageAndPriorities(),
  // buildNextBestActionText()) — no new financial math or wording, just
  // wiring the existing output into the notification pipeline. Only the
  // single TOP priority is notified (matches the dashboard showing one
  // "next best action" at a time, not all 8 at once), and the dedupe key
  // includes the priority type so a change in what's most urgent re-notifies
  // while the same standing issue doesn't repeat every day.
  if (enabled("priority_alert")) {
    const { topPriority } = await getLifeStageAndPriorities();
    if (topPriority) {
      const t = (key: string) => translate(dict, key);
      const { actionText } = buildNextBestActionText(topPriority, t);
      const priorityLabels = dict.priorityEngine.priorities as Record<string, string>;
      drafts.push({
        type: "priority_alert",
        title: priorityLabels[topPriority.priorityType] ?? dict.notifications.categories.priority_alert,
        body: actionText,
        dedupeKey: `priority_alert:${monthKey()}:${topPriority.priorityType}`,
      });
    }
  }

  if (drafts.length === 0) return;

  // Each insert is independent — a unique-constraint conflict on an
  // already-notified condition is expected and simply ignored, not an error.
  await Promise.all(
    drafts.map((draft) =>
      supabase.from("financial_notifications").insert({
        user_id: user.id,
        type: draft.type,
        title: draft.title,
        body: draft.body,
        dedupe_key: draft.dedupeKey,
        related_id: draft.relatedId ?? null,
      })
    )
  );
}
