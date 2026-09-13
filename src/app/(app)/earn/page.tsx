import type { Metadata } from "next";

import { EarnOverview } from "@/features/earn/components/earn-overview";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default function EarnPage() {
  return <EarnOverview />;
}
