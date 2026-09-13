import { getIncomeTarget } from "@/features/income-target/queries";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { calculateIncomeGap } from "@/lib/financial/income-gap";
import { parseMoneyToCents } from "@/lib/financial/money";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { IncomeTargetForm } from "./income-target-form";
import { IncomeGapCard } from "./income-gap-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function IncomeTargetSection() {
  const [target, { profile }, appProfile] = await Promise.all([
    getIncomeTarget(),
    getIncomeProfileSummary(),
    getProfile(),
  ]);
  const locale = await getLocale(appProfile?.preferred_language);
  const dict = getDictionary(locale);

  const gap = calculateIncomeGap({
    targetMonthlyIncomeCents:
      target?.target_monthly_income !== null && target?.target_monthly_income !== undefined
        ? parseMoneyToCents(target.target_monthly_income)
        : null,
    averageMonthlyIncomeCents: profile.averageMonthlyIncomeCents,
  });

  return (
    <div className="space-y-4">
      <IncomeGapCard gap={gap} averageMonthlyIncomeCents={profile.averageMonthlyIncomeCents} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.earn.target.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeTargetForm target={target} />
        </CardContent>
      </Card>
    </div>
  );
}
