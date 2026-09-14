"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { friendlyDbError } from "@/lib/db-error";
import { buildMonthlyReviewSnapshot } from "@/features/monthly-review/queries";
import { awardXpOnce } from "@/features/engagement/actions";
import { trackEvent } from "@/lib/analytics";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function getRequestDictionary() {
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  return getDictionary(locale);
}

function parseReflectionFields(formData: FormData) {
  return {
    what_went_well: (formData.get("what_went_well") as string) || null,
    what_to_reduce: (formData.get("what_to_reduce") as string) || null,
    next_month_focus: (formData.get("next_month_focus") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

/** Saves reflection notes without marking the review complete — resumable across sessions. */
export async function saveMonthlyReviewDraft(
  year: number,
  month: number,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const { error } = await supabase
    .from("monthly_reviews")
    .upsert({ ...parseReflectionFields(formData), user_id: user.id, year, month }, { onConflict: "user_id,year,month" });
  if (error) return { error: friendlyDbError(error, "saveMonthlyReviewDraft", dict.monthlyReview.saveFailed) };

  revalidatePath("/review");
  return { success: true };
}

/**
 * Freezes the deterministic snapshot at completion time (so a review always
 * reflects what was true when the user actually did it) and awards XP
 * exactly once per review, via the same `related_id`-deduped ledger every
 * other XP-earning action uses.
 */
export async function completeMonthlyReview(
  year: number,
  month: number,
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const dict = await getRequestDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: dict.common.pleaseLogin };

  const snapshot = await buildMonthlyReviewSnapshot(year, month);

  const { data: review, error } = await supabase
    .from("monthly_reviews")
    .upsert(
      {
        ...parseReflectionFields(formData),
        user_id: user.id,
        year,
        month,
        income_cents: snapshot.incomeCents,
        expenses_cents: snapshot.expensesCents,
        cash_flow_cents: snapshot.cashFlowCents,
        savings_rate_percent: snapshot.savingsRatePercent,
        net_worth_change_cents: snapshot.netWorthChangeCents,
        budget_percent_used: snapshot.budgetPercentUsed,
        debt_paid_cents: snapshot.debtPaidCents,
        emergency_fund_months_protected: snapshot.emergencyFundMonthsProtected,
        goals_progress_percent: snapshot.goalsProgressPercent,
        income_gap_cents: snapshot.incomeGapCents,
        missions_completed_count: snapshot.missionsCompletedCount,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" }
    )
    .select("id")
    .single();
  if (error || !review) return { error: friendlyDbError(error ?? { message: "upsert failed" }, "completeMonthlyReview", dict.monthlyReview.saveFailed) };

  await awardXpOnce(user.id, "monthly_review_completed", review.id);
  trackEvent("monthly_review_completed", user.id, { year, month });

  revalidatePath("/review");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Single entry point for the review form — one `<form>`, one action, and
 * the submitting button's own `name="intent"` decides which path runs
 * (native HTML: a submit button's name/value is only included in the
 * FormData when that specific button triggered the submit). Avoids the
 * fragility of wiring two `useActionState` hooks to two different buttons
 * inside what would otherwise need to be two separate `<form>` elements.
 */
export async function saveOrCompleteMonthlyReview(
  year: number,
  month: number,
  prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const intent = formData.get("intent");
  if (intent === "complete") {
    return completeMonthlyReview(year, month, prev, formData);
  }
  return saveMonthlyReviewDraft(year, month, prev, formData);
}
