import Link from "next/link";

import { getEntitlements } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { cn } from "@/lib/utils";

/**
 * Dashboard integration (Day 7 STEP 14): "only minimal billing UI (subtle
 * current plan badge...)". Deliberately just a small pill linking to
 * /pricing (Free) or /billing (Plus/Pro) — never a pricing pitch on the
 * dashboard itself.
 */
export async function PlanBadge() {
  const [entitlements, profile] = await Promise.all([getEntitlements(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  const isFree = entitlements.plan === "free";

  return (
    <Link
      href={isFree ? "/pricing" : "/billing"}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        isFree ? "text-muted-foreground hover:text-foreground" : "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      {entitlements.definition.displayName}
      {isFree ? ` · ${dict.billing.upgradeShort}` : ""}
    </Link>
  );
}
