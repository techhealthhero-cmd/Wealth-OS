"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

const TABS = [
  { href: "/plan/goals", key: "goals.title" },
  { href: "/plan/emergency-fund", key: "emergencyFund.title" },
  { href: "/plan/money-year", key: "moneyYear.title" },
  { href: "/plan/debt", key: "debtPlanner.title" },
  { href: "/plan/forecast", key: "forecast.title" },
] as const;

export function PlanTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex w-max gap-1 rounded-lg border bg-muted p-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-(--motion-normal) ease-(--ease-standard)",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
