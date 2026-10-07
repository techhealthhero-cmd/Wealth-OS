"use client";

import type { ReactNode } from "react";
import { CalendarRange, ChartLine, HandCoins, ShieldCheck, Target } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS = [
  { href: "/plan/goals", key: "goals.title", icon: Target },
  { href: "/plan/emergency-fund", key: "emergencyFund.title", icon: ShieldCheck },
  { href: "/plan/money-year", key: "moneyYear.title", icon: CalendarRange },
  { href: "/plan/debt", key: "debtPlanner.title", icon: HandCoins },
  { href: "/plan/forecast", key: "forecast.title", icon: ChartLine },
] as const;

export function PlanTabs({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), icon: tab.icon }))}>{children}</SegmentedTabs>;
}
