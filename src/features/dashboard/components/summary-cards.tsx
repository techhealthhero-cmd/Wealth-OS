import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/shared/icon-chip";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { cn } from "@/lib/utils";

interface SummaryCardsLabels {
  income: string;
  expenses: string;
  cashFlow: string;
  savingsRate: string;
}

interface SummaryCardsProps {
  incomeCents: number;
  expensesCents: number;
  cashFlowCents: number;
  savingsRatePercent: number;
  currencyCode: string;
  labels: SummaryCardsLabels;
}

export function SummaryCards({
  incomeCents,
  expensesCents,
  cashFlowCents,
  savingsRatePercent,
  currencyCode,
  labels,
}: SummaryCardsProps) {
  const cards = [
    {
      label: labels.income,
      rawValue: incomeCents,
      formatAs: "money" as const,
      icon: ArrowUpRight,
      tone: "text-emerald-600 dark:text-emerald-400",
      chipTone: "mint" as const,
    },
    {
      label: labels.expenses,
      rawValue: expensesCents,
      formatAs: "money" as const,
      icon: ArrowDownRight,
      tone: "text-rose-600 dark:text-rose-400",
      chipTone: "slate" as const,
    },
    {
      label: labels.cashFlow,
      rawValue: cashFlowCents,
      formatAs: "money" as const,
      icon: Wallet,
      tone: cashFlowCents < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
      chipTone: "lavender" as const,
    },
    {
      label: labels.savingsRate,
      rawValue: savingsRatePercent,
      formatAs: "percent1" as const,
      icon: PiggyBank,
      tone: savingsRatePercent < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
      chipTone: "mint" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
