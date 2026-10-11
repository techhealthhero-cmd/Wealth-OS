"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type ListTab = "all" | "pending";

/** "ทั้งหมด | รอตรวจ N" (2026-10-11): the pending review list gets its own tab instead of a box above the list. */
export function ListTabs({ active, pendingCount }: { active: ListTab; pendingCount: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function select(tab: ListTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "pending") params.set("tab", "pending");
    else params.delete("tab");
    startTransition(() => router.push(`/money/transactions?${params.toString()}`, { scroll: false }));
  }

  return (
    <div role="tablist" className="flex border-b">
      {(["all", "pending"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => select(tab)}
          className={cn(
            "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-sm transition-colors",
            active === tab ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab === "all" ? t("transactions.tabs.all") : t("transactions.tabs.pending")}
          {tab === "pending" && pendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-800 tabular-nums dark:text-amber-300">
              {pendingCount}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
