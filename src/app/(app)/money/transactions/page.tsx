import type { Metadata } from "next";

import { TransactionList } from "@/features/transactions/components/transaction-list";
import type { TransactionType } from "@/types/database";

export const metadata: Metadata = { title: "Transactions — Wealth OS" };

interface TransactionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
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
      }}
    />
  );
}
