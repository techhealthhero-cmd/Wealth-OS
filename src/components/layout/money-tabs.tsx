"use client";

import { CalendarClock, ChartColumn, ChartPie, CreditCard, Gem, ReceiptText, Repeat, Wallet } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { SegmentedTabs } from "./segmented-tabs";

const TABS = [
  { href: "/money/transactions", key: "nav.transactions", icon: ReceiptText },
  { href: "/money/accounts", key: "nav.accounts", icon: Wallet },
  { href: "/money/budget", key: "budget.title", icon: ChartColumn },
  { href: "/money/assets", key: "assets.title", icon: ChartPie },
  { href: "/money/liabilities", key: "liabilities.title", icon: CreditCard },
  { href: "/money/net-worth", key: "netWorth.title", icon: Gem },
  { href: "/money/recurring", key: "recurring.title", icon: Repeat },
  { href: "/money/subscriptions", key: "subscriptions.title", icon: CalendarClock },
] as const;

export function MoneyTabs() {
  const { t } = useTranslation();
  return <SegmentedTabs tabs={TABS.map((tab) => ({ href: tab.href, label: t(tab.key), icon: tab.icon }))} />;
}
