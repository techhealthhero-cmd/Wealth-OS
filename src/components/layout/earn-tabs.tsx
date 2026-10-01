"use client";

import { Banknote, LayoutGrid, ListChecks, type LucideIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS: { href: string; key: string; icon: LucideIcon; isActive?: (pathname: string) => boolean }[] = [
  { href: "/earn", key: "earn.tabs.overview", icon: LayoutGrid, isActive: (pathname) => pathname === "/earn" || pathname.startsWith("/earn/diagnostic") },
  { href: "/earn/missions", key: "earn.tabs.missions", icon: ListChecks, isActive: (pathname) => pathname.startsWith("/earn/missions") || pathname.startsWith("/earn/paths") },
  { href: "/earn/income", key: "earn.tabs.income", icon: Banknote, isActive: (pathname) => pathname.startsWith("/earn/income") },
];

export function EarnTabs() {
  const { t } = useTranslation();
  return (
    <SegmentedTabs
      stretch
      tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), icon: tab.icon, isActive: tab.isActive }))}
    />
  );
}
