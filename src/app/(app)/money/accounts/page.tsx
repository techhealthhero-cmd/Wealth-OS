import type { Metadata } from "next";

import { AccountList } from "@/features/accounts/components/account-list";

export const metadata: Metadata = { title: "Accounts — Wealth OS" };

export default function AccountsPage() {
  return <AccountList />;
}
