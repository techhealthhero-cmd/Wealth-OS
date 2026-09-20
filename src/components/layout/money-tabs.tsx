"use client";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS = [
  { href: "/money/transactions", key: "nav.transactions" },
  { href: "/money/accounts", key: "nav.accounts" },
  { href: "/money/budget", key: "budget.title" },
  { href: "/money/assets", key: "assets.title" },
  { href: "/money/liabilities", key: "liabilities.title" },
  { href: "/money/net-worth", key: "netWorth.title" },
  { href: "/money/recurring", key: "recurring.title" },
  { href: "/money/subscriptions", key: "subscriptions.title" },
] as const;

export function MoneyTabs() {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key) }))} />;
}
