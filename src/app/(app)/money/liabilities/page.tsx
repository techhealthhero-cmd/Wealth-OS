import type { Metadata } from "next";

import { LiabilityList } from "@/features/liabilities/components/liability-list";

export const metadata: Metadata = { title: "Liabilities — Wealth OS" };

export default function LiabilitiesPage() {
  return <LiabilityList />;
}
