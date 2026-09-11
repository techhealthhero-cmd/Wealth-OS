"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

const TABS = [
  { href: "/money/transactions", key: "nav.transactions" },
  { href: "/money/accounts", key: "nav.accounts" },
] as const;

export function MoneyTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
  );
}
