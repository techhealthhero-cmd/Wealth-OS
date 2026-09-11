import type { Metadata } from "next";

import { getEmergencyFund, getEssentialMonthlyExpenses } from "@/features/emergency-fund/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getGoals } from "@/features/goals/queries";
import { EmergencyFundView } from "@/features/emergency-fund/components/emergency-fund-view";

export const metadata: Metadata = { title: "Emergency Fund — Wealth OS" };

export default async function EmergencyFundPage() {
  const [emergencyFund, essential, accounts, goals] = await Promise.all([
    getEmergencyFund(),
    getEssentialMonthlyExpenses(),
    getAccounts(),
    getGoals(),
  ]);

  return (
    <EmergencyFundView
      emergencyFund={emergencyFund}
      essentialMonthlyExpensesCents={essential.cents}
      hasEssentialData={essential.hasData}
      accounts={accounts}
      goals={goals}
    />
  );
}
