import type { Metadata } from "next";

import {
  getDefaultBaseAssumptions,
  getForecastScenarios,
  getForecastStartingState,
  scenarioRowToAssumptions,
} from "@/features/forecast/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { ForecastView } from "@/features/forecast/components/forecast-view";
import { ForecastScenarioForm } from "@/features/forecast/components/forecast-scenario-form";
import { EmptyState } from "@/components/shared/empty-state";
import { WelcomeIllustration } from "@/components/illustrations";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";
import { LockedFeatureCard } from "@/features/billing/components/locked-feature-card";

export const metadata: Metadata = { title: "Forecast — Wealth OS" };

export default async function ForecastPage() {
  // requireFeature() doesn't depend on profile — perf audit finding: these
  // were sequential for no reason, each paying its own round-trip.
  const [profile, gate] = await Promise.all([getProfile(), requireFeature(FEATURES.FORECAST)]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <LockedFeatureCard
          title={dict.billing.locked.forecastTitle}
          description={dict.billing.locked.forecastDescription}
          ctaLabel={dict.billing.upgradeCta}
        />
      </div>
    );
  }

  const [scenarios, startingState, defaultAssumptions] = await Promise.all([
    getForecastScenarios(),
    getForecastStartingState(),
    getDefaultBaseAssumptions(),
  ]);

  if (scenarios.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <EmptyState
          illustration={<WelcomeIllustration size={140} />}
          title={dict.forecast.emptyTitle}
          description={dict.forecast.emptyState}
          action={<ForecastScenarioForm defaults={defaultAssumptions} />}
        />
      </div>
    );
  }

  const scenariosWithAssumptions = scenarios.map((row) => ({
    row,
    assumptions: scenarioRowToAssumptions(row),
  }));

  return (
    <ForecastView
      startingState={startingState}
      scenarios={scenariosWithAssumptions}
      defaultAssumptions={defaultAssumptions}
    />
  );
}
