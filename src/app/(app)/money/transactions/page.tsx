import type { Metadata } from "next";

import { TransactionList } from "@/features/transactions/components/transaction-list";
import type { TransactionType } from "@/types/database";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";

export const metadata: Metadata = { title: "Transactions — Wealth OS" };

interface TransactionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const privacyGate = await getPrivacyGate("activity");
  if (privacyGate) {
    return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  }

  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return (
    <TransactionList
      filters={{
        search: get("q"),
        type: get("type") as TransactionType | undefined,
        accountId: get("accountId"),
        categoryId: get("categoryId"),
        from: get("from"),
        to: get("to"),
        hasNotes: get("notes") === "1",
      }}
    />
  );
}
