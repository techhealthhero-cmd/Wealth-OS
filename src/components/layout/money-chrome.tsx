"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MoneyTabs } from "./money-tabs";
export function MoneyChrome({ children, title }: { children: ReactNode; title: string }) {
  const pathname = usePathname();
  if (pathname === "/money/invoices" || pathname.startsWith("/money/invoices/"))
    return <div className="pb-28">{children}</div>;
  return (
    <div className="space-y-4 pb-28">
      <div>
        <h1 className="text-2xl font-semibold">
          <span className="journal-heading">{title}</span>
        </h1>
      </div>
      <MoneyTabs>{children}</MoneyTabs>
    </div>
  );
}
