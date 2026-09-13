import type { Metadata } from "next";

import { IncomeSourceList } from "@/features/income-sources/components/income-source-list";
import { IncomeTargetSection } from "@/features/income-target/components/income-target-section";

export const metadata: Metadata = { title: "Income — Wealth OS" };

export default function EarnIncomePage() {
  return (
    <div className="space-y-6">
      <IncomeTargetSection />
      <IncomeSourceList />
    </div>
  );
}
