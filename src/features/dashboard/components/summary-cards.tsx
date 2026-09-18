import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { QuickAdd } from "@/features/transactions/components/quick-add";
import { cn } from "@/lib/utils";

interface SummaryCardsLabels {
  income: string;
  expenses: string;
  cashFlow: string;
  savingsRate: string;
  vsLastMonth: string;
  noDataTitle: string;
  noDataHint: string;
}

interface SummaryCardsProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  /** Percent change vs. last month; null when there's nothing to compare against (see calculateChangePercent). */
  incomeChangePercent: number | null;
  expensesChangePercent: number | null;
  cashFlowChangePercent: number | null;
  /** Percentage-POINT difference, not calculateChangePercent — savings rate is already a percentage. */
  savingsRateChangePoints: number | null;
  hasDataThisMonth: boolean;
  currencyCode: string;
  labels: SummaryCardsLabels;
  accounts: Account[];
  categories: Category[];
}

/**
 * A card's own soft background tint — deliberately NOT the shared Card
 * "soft" variant (its own doc comment reserves that tier for "a secondary-
 * emphasis moment... never for dense data/list cards"). This is a much
 * lighter, bespoke tint (~8%, vs. IconChip's 20-25% for the same hue) that
 * stays a "hairline" visual cue rather than a second card tier.
 */
const TINT_CLASSES = {
  mint: "bg-[#7FD6B2]/8",
  rose: "bg-rose-500/6 dark:bg-rose-400/8",
  slate: "bg-[#8EA2B8]/8",
  lavender: "bg-[#B8B0CC]/10",
} as const;

function TrendLine({
  changeValue,
  unit,
  label,
  invertTone = false,
}: {
  changeValue: number | null;
  /** "%" for a genuine percent change; "pp" (percentage points) for savings rate, which is already a percentage. */
  unit: "%" | "pp";
  label: string;
  invertTone?: boolean;
}) {
  if (changeValue === null) return null;
  // For "expenses," a decrease is the good outcome — invertTone flips which
  // direction reads as positive/green vs negative/rose, without changing
  // the arrow direction itself (the arrow always matches the real sign).
  const isGoodDirection = invertTone ? changeValue <= 0 : changeValue >= 0;
  const Icon = changeValue >= 0 ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-0.5 text-xs",
        isGoodDirection ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {changeValue >= 0 ? "+" : ""}
      {changeValue.toFixed(1)}
      {unit} {label}
    </p>
  );
}

export function SummaryCards({
  incomeCents,
  expensesCents,
  cashFlowCents,
  savingsRatePercent,
  incomeChangePercent,
  expensesChangePercent,
  cashFlowChangePercent,
  savingsRateChangePoints,
  hasDataThisMonth,
  currencyCode,
  labels,
  accounts,
  categories,
}: SummaryCardsProps) {
  const cards = [
    {
      label: labels.income,
      rawValue: incomeCents,
      formatAs: "money" as const,
      icon: ArrowUpRight,
      tone: "text-emerald-600 dark:text-emerald-400",
      chipTone: "mint" as const,
      tint: TINT_CLASSES.mint,
      trend: <TrendLine changeValue={incomeChangePercent} unit="%" label={labels.vsLastMonth} />,
    },
    {
      label: labels.expenses,
      rawValue: expensesCents,
      formatAs: "money" as const,
      icon: ArrowDownRight,
      tone: "text-rose-600 dark:text-rose-400",
      chipTone: "slate" as const,
      tint: TINT_CLASSES.rose,
      trend: <TrendLine changeValue={expensesChangePercent} unit="%" label={labels.vsLastMonth} invertTone />,
    },
    {
      label: labels.cashFlow,
      rawValue: cashFlowCents,
      formatAs: "money" as const,
      icon: Wallet,
      tone: cashFlowCents < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
      chipTone: "lavender" as const,
      tint: cashFlowCents < 0 ? TINT_CLASSES.rose : TINT_CLASSES.mint,
      trend: <TrendLine changeValue={cashFlowChangePercent} unit="%" label={labels.vsLastMonth} />,
    },
    {
      label: labels.savingsRate,
      rawValue: savingsRatePercent,
      formatAs: "percent1" as const,
      icon: PiggyBank,
      tone: savingsRatePercent < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
      chipTone: "mint" as const,
      tint: savingsRatePercent < 0 ? TINT_CLASSES.rose : TINT_CLASSES.lavender,
      trend: <TrendLine changeValue={savingsRateChangePoints} unit="pp" label={labels.vsLastMonth} />,
    },
  ];

  // UX_GUIDELINES.md #10: never show a dead "฿0" grid with nothing to do
  // about it — when literally nothing's been logged yet this month (as
  // opposed to one specific metric legitimately being zero while others
  // aren't), replace the 4 flat zero-tiles with one clear next action.
  if (!hasDataThisMonth) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <IconChip icon={Wallet} tone="lavender" className="size-10" />
          <div className="space-y-1">
            <p className="font-medium">{labels.noDataTitle}</p>
            <p className="text-sm text-muted-foreground">{labels.noDataHint}</p>
          </div>
          <QuickAdd accounts={accounts} categories={categories} variant="inline" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className={card.tint}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <IconChip icon={card.icon} tone={card.chipTone} className="size-7" />
          </CardHeader>
          <CardContent>
            {/* 2026-09 motion system: short count-up on first appearance for
                these headline monthly figures — see AnimatedNumber. */}
            <AnimatedNumber
              value={card.rawValue}
              formatAs={card.formatAs}
              currencyCode={currencyCode}
              className={cn("block text-xl font-semibold sm:text-2xl", card.tone)}
            />
            {card.trend}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
