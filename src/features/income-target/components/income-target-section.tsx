import { getIncomeTarget } from "@/features/income-target/queries";
import { getIncomeProfileSummary } from "@/features/income-profile/queries";
import { calculateIncomeGap } from "@/lib/financial/income-gap";
import { parseMoneyToCents } from "@/lib/financial/money";
import { IncomeTargetView } from "./income-target-view";
import { IncomeGapCard } from "./income-gap-card";

export async function IncomeTargetSection() {
  const [target, { profile }] = await Promise.all([getIncomeTarget(), getIncomeProfileSummary()]);

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
      <IncomeTargetView target={target} />
    </div>
  );
}
