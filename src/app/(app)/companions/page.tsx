import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getProfile } from "@/features/profile/queries";
import { getCompanionState, getCompanionUnlockFacts } from "@/features/companions/queries";
import { CompanionPicker, type CompanionCardData } from "@/features/companions/components/companion-picker";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { COMPANIONS } from "@/lib/companions/catalog";
import { getUnlockProgress, isCompanionAvailable } from "@/lib/companions/unlock";
import { FEATURES } from "@/lib/billing/plans";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { COMPANION_FINANCIAL_SCOPES } from "@/features/companions/privacy";

export const metadata: Metadata = { title: "Companions — Wealth OS" };

/**
 * Companion picker (ภูติคู่หู). Every lock state shown here is computed
 * server-side from real data and the user's actual plan — the client only
 * renders it and calls the validated `selectCompanion` action.
 */
export default async function CompanionsPage() {
  // The privacy gate doesn't need the profile result — load both at once.
  const [profile, privacyGate] = await Promise.all([getProfile(), getPrivacyGate(COMPANION_FINANCIAL_SCOPES)]);
  if (!profile) redirect("/login");

  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const [state, facts, locale] = await Promise.all([
    getCompanionState(),
    getCompanionUnlockFacts(),
    getLocale(profile.preferred_language),
  ]);
  const dict = getDictionary(locale);
  const unlocked = new Set(state.unlockedIds);

  const cards: CompanionCardData[] = COMPANIONS.map((c) => {
    const available = isCompanionAvailable(c, unlocked, state.features);
    const progress = c.access.type === "progress" && !available ? getUnlockProgress(c.access.rule, facts) : null;
    return {
      id: c.id,
      kind: c.kind,
      image: c.image,
      focus: c.focus,
      available,
      selected: c.id === state.active.id,
      starter: c.access.type === "starter",
      unlockRule: c.access.type === "progress" ? c.access.rule : null,
      requiredPlan:
        c.access.type === "plan" ? (c.access.feature === FEATURES.COMPANION_PRO_WIZARD ? "pro" : "plus") : null,
      progress,
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-28">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold text-balance">{dict.companions.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.companions.pageSubtitle}</p>
      </header>
      <CompanionPicker cards={cards} presenceAvailable={state.presence} />
    </div>
  );
}
