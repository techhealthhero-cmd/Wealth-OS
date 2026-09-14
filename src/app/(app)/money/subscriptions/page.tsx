import type { Metadata } from "next";

import { SubscriptionList } from "@/features/subscriptions/components/subscription-list";

export const metadata: Metadata = { title: "Subscriptions — Wealth OS" };

export default function MoneySubscriptionsPage() {
  return <SubscriptionList />;
}
