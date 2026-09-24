import type { Metadata } from "next";

import { getEntitlements } from "@/lib/billing/entitlements";
import { getAIUsageStatus } from "@/lib/billing/ai-usage";
import { getSubscription } from "@/features/billing/queries";
import { getAuthUser } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { BillingStatusCard } from "@/features/billing/components/billing-status-card";

export const metadata: Metadata = { title: "Billing — Wealth OS" };

interface BillingPageProps {
  searchParams: Promise<{ checkout?: string }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { checkout } = await searchParams;

  const user = await getAuthUser();

  // perf audit finding: getAIUsageStatus only needs `user` (already
  // resolved above), so it doesn't need to wait for the other 3 — folded
  // into the same Promise.all instead of running after it.
  const [entitlements, subscription, profile, usage] = await Promise.all([
    getEntitlements(),
    getSubscription(),
    getProfile(),
    user ? getAIUsageStatus(user.id) : Promise.resolve(null),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  // STEP 8: never activate paid access solely from this redirect — the
  // webhook is the only trusted confirmation. If Stripe hasn't confirmed
  // yet (still shows Free here), say so plainly instead of claiming success.
  const showPendingConfirmation = checkout === "success" && entitlements.plan === "free";
  const showCanceledNotice = checkout === "canceled";

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{dict.billing.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.billing.subtitle}</p>
      </div>

      {showPendingConfirmation ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{dict.billing.checkoutPending}</p>
      ) : null}
      {showCanceledNotice ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{dict.billing.checkoutCanceled}</p>
      ) : null}

      <BillingStatusCard
        plan={entitlements.plan}
        subscription={subscription}
        usedThisMonth={usage?.used ?? 0}
        aiLimit={entitlements.limits.aiMessagesPerMonth}
        resetDate={usage?.resetDate ?? ""}
        dict={dict}
      />
    </div>
  );
}
