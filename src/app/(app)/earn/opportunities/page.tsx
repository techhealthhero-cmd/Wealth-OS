import type { Metadata } from "next";

import { OpportunityList } from "@/features/opportunities/components/opportunity-list";

export const metadata: Metadata = { title: "Opportunities — Wealth OS" };

export default function EarnOpportunitiesPage() {
  return <OpportunityList />;
}
