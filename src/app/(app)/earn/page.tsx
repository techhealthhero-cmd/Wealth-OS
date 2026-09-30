import type { Metadata } from "next";

import { EarnHub } from "@/features/earn/components/v2/earn-hub";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

/**
 * Earn V2 Hub. The previous overview (income profile, gap, top opportunity)
 * still lives on the Income and Opportunities tabs; `EarnOverview` is kept
 * in the codebase for reference but no longer rendered here.
 */
export default function EarnPage() {
  return <EarnHub />;
}
