"use client";

import { Banknote, Compass, LayoutGrid, ListChecks, Route, Sparkles, type LucideIcon } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS: { href: string; key: string; icon: LucideIcon; isActive?: (pathname: string) => boolean }[] = [
  { href: "/earn/paths", key: "earn.tabs.paths", icon: Route },
  { href: "/earn/skills", key: "earn.tabs.skills", icon: Sparkles },
  { href: "/earn/missions", key: "earn.tabs.missions", icon: ListChecks },
  { href: "/earn/income", key: "earn.tabs.income", icon: Banknote },
  { href: "/earn/opportunities", key: "earn.tabs.opportunities", icon: Compass },
  { href: "/earn", key: "earn.tabs.overview", icon: LayoutGrid, isActive: (pathname) => pathname === "/earn" || pathname.startsWith("/earn/diagnostic") },
];

export function EarnTabs() {
  const { t } = useTranslation();
  return (
    <SegmentedTabs
      tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), icon: tab.icon, isActive: tab.isActive }))}
    />
  );
}
