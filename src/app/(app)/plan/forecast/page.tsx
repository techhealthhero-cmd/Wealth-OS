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

export const metadata: Metadata = { title: "Forecast — Wealth OS" };

export default async function ForecastPage() {
  const [scenarios, startingState, defaultAssumptions, profile] = await Promise.all([
    getForecastScenarios(),
    getForecastStartingState(),
    getDefaultBaseAssumptions(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

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
