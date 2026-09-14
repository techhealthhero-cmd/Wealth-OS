import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getAIUsageStatus } from "@/lib/billing/ai-usage";
import { getEntitlements } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";

/**
 * Usage UI (Day 7 STEP 10): clear "messages remaining" / "limit reached" /
 * reset date / upgrade CTA states, so the chat's own 403 error is never the
 * user's first signal that a limit exists. Renders nothing when signed out
 * (shouldn't happen inside the authenticated (app) layout, but this
 * component has no other reason to ever be used outside it).
 */
export async function AIUsageIndicator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [usage, entitlements, profile] = await Promise.all([getAIUsageStatus(user.id), getEntitlements(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const nearOrAtLimit = usage.limit !== null && usage.remaining !== null && usage.remaining <= 3;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        {dict.aiCoach.usageLabel}: {usage.used}/{usage.limit}
        {usage.limitReached ? ` · ${dict.aiCoach.limitReachedShort} (${usage.resetDate})` : ""}
      </span>
      {entitlements.plan === "free" && nearOrAtLimit ? (
        <Link href="/pricing" className="font-medium text-primary hover:underline">
          {dict.aiCoach.upgradeCta}
        </Link>
      ) : null}
    </div>
  );
}
