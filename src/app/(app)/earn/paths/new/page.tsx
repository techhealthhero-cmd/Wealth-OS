import type { Metadata } from "next";

import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getExperiment } from "@/lib/earn/recommendations";
import { INCOME_PATH_TYPES, type IncomePathType } from "@/lib/earn/types";
import { CreatePathForm } from "@/features/earn/components/v2/create-path-form";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function NewIncomePathPage({ searchParams }: { searchParams: Promise<{ type?: string; experiment?: string }> }) {
  const params = await searchParams;
  const profile = await getProfile();
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  // Only catalog keys / known types are honoured — never free text from the URL.
  const experiment = params.experiment ? getExperiment(params.experiment) : null;
  const type = (experiment?.pathType ??
    ((INCOME_PATH_TYPES as readonly string[]).includes(params.type ?? "") ? params.type : null)) as IncomePathType | null;
  const experiments = dict.earn.v2.experiments as Record<string, { title: string }>;
  return (
    <CreatePathForm
      defaultType={type}
      defaultTitle={experiment ? experiments[experiment.key]?.title ?? "" : ""}
      experimentKey={experiment?.key ?? null}
    />
  );
}
