import { getProfile } from "@/features/profile/queries";
import { getUserSkills } from "@/features/skills/queries";
import { getLocale } from "@/i18n/server";
import { getIncomePlans } from "../queries";
import { IncomePathPlanner } from "./income-path-planner";

export async function IncomePlannerSection() {
  const [plans, skills, profile] = await Promise.all([
    getIncomePlans(),
    getUserSkills(),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);

  return (
    <IncomePathPlanner
      plans={plans}
      skills={skills}
      currencyCode={profile?.currency_code ?? "THB"}
      locale={locale}
    />
  );
}
