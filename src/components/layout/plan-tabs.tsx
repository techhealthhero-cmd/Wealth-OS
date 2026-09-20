"use client";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS = [
  { href: "/plan/goals", key: "goals.title" },
  { href: "/plan/emergency-fund", key: "emergencyFund.title" },
  { href: "/plan/money-year", key: "moneyYear.title" },
  { href: "/plan/debt", key: "debtPlanner.title" },
  { href: "/plan/forecast", key: "forecast.title" },
] as const;

export function PlanTabs() {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key) }))} />;
}
