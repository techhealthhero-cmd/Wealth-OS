"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Updates /money/transactions query params without scrolling the month away. */
export function useTransactionsQuery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function push(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/money/transactions?${query}` : "/money/transactions", { scroll: false });
    });
  }

  return { pending, push };
}
