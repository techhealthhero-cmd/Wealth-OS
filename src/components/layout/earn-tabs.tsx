"use client";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS: { href: string; key: string; isActive?: (pathname: string) => boolean }[] = [
  { href: "/earn/skills", key: "earn.tabs.skills" },
  { href: "/earn/missions", key: "earn.tabs.missions" },
  { href: "/earn/income", key: "earn.tabs.income" },
  { href: "/earn/opportunities", key: "earn.tabs.opportunities" },
  { href: "/earn", key: "earn.tabs.overview", isActive: (pathname) => pathname === "/earn" },
];

export function EarnTabs() {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), isActive: tab.isActive }))} />;
}
