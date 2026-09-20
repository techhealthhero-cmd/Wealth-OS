"use client";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS: { href: string; key: string; isActive?: (pathname: string) => boolean }[] = [
  { href: "/earn", key: "earn.tabs.overview", isActive: (pathname) => pathname === "/earn" },
  { href: "/earn/income", key: "earn.tabs.income" },
  { href: "/earn/skills", key: "earn.tabs.skills" },
  { href: "/earn/opportunities", key: "earn.tabs.opportunities" },
  { href: "/earn/missions", key: "earn.tabs.missions" },
];

export function EarnTabs() {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), isActive: tab.isActive }))} />;
}
