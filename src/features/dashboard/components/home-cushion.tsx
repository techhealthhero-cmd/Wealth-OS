import { captureError } from "@/lib/observability";
import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getSafeToSpend } from "@/features/safe-to-spend/queries";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";
import { parseMoneyToCents } from "@/lib/financial/money";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { InlineLoadError } from "@/components/shared/inline-load-error";
import { HomeCushionTiles, type HomeCushionTilesProps } from "./home-tiles";

type LoadedCushion = Omit<HomeCushionTilesProps, "labels"> & { dict: ReturnType<typeof getDictionary> };

/**
 * Same queries and the same calculateMonthsProtected() the details grid
 * (wealth-overview.tsx) already uses — no new money formula. Errors are
 * caught here, never around JSX (see net-worth-hero.tsx).
 */
async function loadCushion(): Promise<LoadedCushion | null> {
  try {
    const [profile, emergencyFund, essential, safeToSpend] = await Promise.all([
      getProfile(),
      getEmergencyFund(),
      getEssentialMonthlyExpenses(),
      getSafeToSpend(),
    ]);
    const dict = getDictionary(await getLocale(profile?.preferred_language));
    const target = emergencyFund?.target_months ? Number(emergencyFund.target_months) : null;
    const emergency: HomeCushionTilesProps["emergency"] = !emergencyFund
      ? { status: "not_set_up" }
      : essential.cents <= 0
        ? { status: "needs_expenses" }
        : {
            status: "ready",
            monthsProtected: calculateMonthsProtected(parseMoneyToCents(emergencyFund.current_amount), essential.cents),
            targetMonths: target !== null && Number.isFinite(target) ? target : null,
          };
    return {
      dict,
      emergency,
      safeToSpend:
        safeToSpend.hasCompleteData && safeToSpend.result
          ? { thisMonthCents: safeToSpend.result.thisMonthCents, todayCents: safeToSpend.result.todayCents }
          : null,
      currencyCode: profile?.currency_code ?? "THB",
    };
  } catch (error) {
    captureError(error, { route: "dashboard.HomeCushion", operation: "load_home_cushion" });
    return null;
  }
}

/** Home's "cash cushion" + "left to spend this month" tiles. */
export async function HomeCushion() {
  const loaded = await loadCushion();
  if (!loaded) {
    const dict = getDictionary(await getLocale());
    return <InlineLoadError message={dict.common.somethingWentWrong} />;
  }
  const { dict, ...props } = loaded;
  return <HomeCushionTiles {...props} labels={homeCushionLabels(dict)} />;
}

export function homeCushionLabels(dict: ReturnType<typeof getDictionary>): HomeCushionTilesProps["labels"] {
  return { ...dict.homeDash, safeIncomplete: dict.safeToSpend.incompleteDataHint };
}
