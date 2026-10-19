"use client";

import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { requestQuickAdd, type QuickAddRequestTarget } from "@/features/transactions/lib/quick-add-request";
import { cn } from "@/lib/utils";
import { SoonChip } from "./soon-chip";

export interface HomeQuickActionsLabels {
  quickActionsLabel: string;
  invoice: string;
  recordIncome: string;
  taxJar: string;
  scanSlip: string;
  comingSoon: string;
  invoiceSoon: string;
  taxJarSoon: string;
}

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-[22px]",
};

const ICONS = {
  invoice: (
    <svg {...ICON_PROPS}>
      <path d="M7 3.5h7l4 4V19.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4M9 12h6M9 15.5h4" />
    </svg>
  ),
  income: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  taxJar: (
    <svg {...ICON_PROPS}>
      <path d="M8.5 3.5h7M7 6.5h10a1 1 0 0 1 1 1v10.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18V7.5a1 1 0 0 1 1-1z" />
      <path d="M6 12h12" />
    </svg>
  ),
  scan: (
    <svg {...ICON_PROPS}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16" />
    </svg>
  ),
};

const TILE =
  "group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl pb-0.5 text-center text-xs leading-[18px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function IconBox({ children, soon }: { children: ReactNode; soon?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid size-12 place-items-center rounded-2xl border bg-card shadow-card transition-transform duration-150 group-active:scale-95 motion-reduce:transition-none",
        soon ? "border-dashed text-muted-foreground" : "text-primary dark:text-[#8fd9b4]"
      )}
    >
      {children}
    </span>
  );
}

/**
 * Home quick actions (2026-10 "C — freelancer dashboard"). Plain labels in,
 * no data. "Log income" and "Scan slip" open the app shell's real Quick Add
 * flows (the income form; the slip camera/file picker followed by Quick
 * Capture’s parse results). Invoices and the tax jar are not built yet:
 * their tiles say so and open a short "coming soon" note — never a
 * placeholder page.
 */
export function HomeQuickActions({ labels }: { labels: HomeQuickActionsLabels }) {
  const router = useRouter();
  // Without the app shell's Quick Add listening, Money › Transactions has
  // the same add-income form and Quick Capture entry points.
  const request = (target: QuickAddRequestTarget) => {
    if (!requestQuickAdd(target)) router.push("/money/transactions");
  };
  const soonItems = [
    { key: "invoice", label: labels.invoice, note: labels.invoiceSoon, icon: ICONS.invoice },
    { key: "taxJar", label: labels.taxJar, note: labels.taxJarSoon, icon: ICONS.taxJar },
  ] as const;

  const soonTile = (item: (typeof soonItems)[number]) => (
    <Popover key={item.key}>
      <PopoverTrigger className={TILE} aria-label={`${item.label} — ${labels.comingSoon}`}>
        <IconBox soon>{item.icon}</IconBox>
        <span className="text-muted-foreground">{item.label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-1.5">
        <p className="flex items-center gap-2 font-semibold leading-snug">
          {item.label}
          <SoonChip>{labels.comingSoon}</SoonChip>
        </p>
        <p className="text-[13px] leading-5 text-muted-foreground">{item.note}</p>
      </PopoverContent>
    </Popover>
  );

  return (
    <nav aria-label={labels.quickActionsLabel} className="grid grid-cols-4 gap-2">
      {soonTile(soonItems[0])}
      <button type="button" className={TILE} onClick={() => request("income")}>
        <IconBox>{ICONS.income}</IconBox>
        <span>{labels.recordIncome}</span>
      </button>
      {soonTile(soonItems[1])}
      <button type="button" className={TILE} onClick={() => request("scan")}>
        <IconBox>{ICONS.scan}</IconBox>
        <span>{labels.scanSlip}</span>
      </button>
    </nav>
  );
}
