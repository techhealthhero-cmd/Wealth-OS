import Link from "next/link";
import { Lightbulb } from "lucide-react";

import type { Locale } from "@/i18n/config";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buddhistYear, type HomeYearInsight, type HomeYearOption, type YearCategoryComparison } from "../lib/home-year";

export interface HomeYearLabels {
  title: string;
  yearSwitcher: string;
  through: string;
  income: string;
  expense: string;
  saved: string;
  categoryTitle: string;
  category: string;
  other: string;
  uncategorized: string;
  emptyYear: string;
  emptyYearHint: string;
  emptyYearCta: string;
  goalsTitle: string;
  goalsEmpty: string;
  goalsEmptyHint: string;
  goalsCta: string;
  goalsAll: string;
  goalProgress: string;
  goalReached: string;
  insightUp: string;
  insightDown: string;
  barsLabel: string;
}

export interface HomeYearGoalView {
  id: string;
  name: string;
  status: string;
  progress: number;
  currentCents: number;
  targetCents: number;
  targetLabel: string | null;
}

export interface HomeYearViewProps {
  labels: HomeYearLabels;
  locale: Locale;
  currencyCode: string;
  selectedYear: number;
  options: HomeYearOption[];
  throughMonth: string | null;
  incomeCents: number;
  expenseCents: number;
  savedCents: number;
  categories: YearCategoryComparison[];
  insight: HomeYearInsight | null;
  goals: HomeYearGoalView[];
}

const CARD = "rounded-[22px] border bg-card p-4 text-card-foreground shadow-card";
const DOTS = ["#204d3d", "#3d9a6a", "#c46a5a", "#c9a15a", "#7f8f88", "#6b8f71", "#b08968"];

function money(cents: number, currencyCode: string): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return formatMoney(cents, currencyCode, currencyCode === "THB" ? "th-TH" : undefined, digits);
}

function barPercent(cents: number, max: number): number {
  if (cents <= 0 || max <= 0) return 0;
  return Math.min(100, Math.max(6, Math.round((cents / max) * 100)));
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export function HomeYearView({
  labels,
  locale,
  currencyCode,
  selectedYear,
  options,
  throughMonth,
  incomeCents,
  expenseCents,
  savedCents,
  categories,
  insight,
  goals,
}: HomeYearViewProps) {
  const selectedBe = buddhistYear(selectedYear);
  const previousBe = buddhistYear(selectedYear - 1);
  const showMoney = incomeCents !== 0 || expenseCents !== 0 || categories.length > 0;
  const maxBar = Math.max(incomeCents, expenseCents, 0);
  const insightYear = locale === "th" ? String(selectedBe).slice(-2) : String(selectedBe);
  const insightPrevious = locale === "th" ? String(previousBe).slice(-2) : String(previousBe);
  const insightSentence = insight
    ? fill(insight.direction === "up" ? labels.insightUp : labels.insightDown, {
        category: insight.label,
        year: insightYear,
        previous: insightPrevious,
        from: money(insight.previousCents, currencyCode),
        to: money(insight.currentCents, currencyCode),
      })
    : null;

  return (
    <div className="space-y-4" data-testid="home-year">
      <section className={CARD} aria-labelledby="home-year-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-year-title" className="text-sm font-semibold">
            {labels.title}
          </h2>
          {throughMonth ? (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {fill(labels.through, { month: throughMonth })}
            </span>
          ) : null}
        </div>

        <nav aria-label={labels.yearSwitcher} className="mt-3">
          <ul className="grid grid-cols-3 gap-1 rounded-full bg-[#f3ecdf] p-1 dark:bg-muted">
            {options.map((option) => {
              const selected = option.gregorian === selectedYear;
              return (
                <li key={option.buddhist}>
                  <Link
                    href={option.href}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-full text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "bg-card font-semibold text-primary shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {option.buddhist}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {showMoney ? (
          <>
            <div className="mt-4 space-y-3" aria-label={fill(labels.barsLabel, { year: String(selectedBe) })}>
              <MoneyBar
                label={labels.income}
                amount={money(incomeCents, currencyCode)}
                percent={barPercent(incomeCents, maxBar)}
                amountClassName="text-[#1d6b48] dark:text-[#8fd4ae]"
                fillClassName="bg-gradient-to-r from-[#1d6b48] to-[#8fd4ae]"
              />
              <MoneyBar
                label={labels.expense}
                amount={money(expenseCents, currencyCode)}
                percent={barPercent(expenseCents, maxBar)}
                amountClassName="text-[#b4574a]"
                fillClassName="bg-gradient-to-r from-[#c46a5a] to-[#e7c4b8]"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#e7f6ee] px-4 py-3 dark:bg-primary/15">
              <span className="text-sm text-[#1d6b48] dark:text-[#b7e4cd]">
                {fill(labels.saved, { year: String(selectedBe) })}
              </span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  savedCents < 0 ? "text-[#b4574a]" : "text-[#143d2c] dark:text-[#d8f3e4]",
                )}
              >
                {money(savedCents, currencyCode)}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-4">
            <p className="text-sm font-medium">{fill(labels.emptyYear, { year: String(selectedBe) })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.emptyYearHint}</p>
            <Button nativeButton={false} className="mt-3" render={<Link href="/money/transactions" />}>
              {labels.emptyYearCta}
            </Button>
          </div>
        )}
      </section>

      {showMoney && categories.length > 0 ? (
        <section className={CARD} aria-labelledby="home-year-categories" data-testid="home-year-categories">
          <h2 id="home-year-categories" className="text-sm font-semibold">
            {labels.categoryTitle}
          </h2>
          <table className="mt-3 w-full table-fixed text-[13px]">
            <caption className="sr-only">{labels.categoryTitle}</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="pb-2 text-left font-normal">
                  {labels.category}
                </th>
                <th scope="col" className="w-[5.75rem] pb-2 text-right font-semibold text-foreground">
                  {selectedBe}
                </th>
                <th scope="col" className="w-[5.75rem] pb-2 pl-3 text-right font-normal">
                  {previousBe}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category, index) => (
                <tr key={category.id} className="border-t border-border/70">
                  <th scope="row" className="max-w-0 py-2.5 text-left font-normal">
                    <span className="flex min-w-0 items-center gap-2">
                      <i
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: category.isOther ? "#8fa399" : DOTS[index % DOTS.length] }}
                      />
                      <span className="truncate">{category.label}</span>
                    </span>
                  </th>
                  <td className="py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">
                    {money(category.currentCents, currencyCode)}
                  </td>
                  <td className="py-2.5 pl-3 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                    {money(category.previousCents, currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {insightSentence ? (
            <p className="mt-3 flex gap-2 rounded-[14px] border border-dashed border-[#b99a65] bg-[#f3ecd8] px-3 py-2.5 text-[13px] leading-5 text-[#5b4a22] dark:border-[#b99a65]/40 dark:bg-[#3a3224] dark:text-[#f3e6c8]">
              <Lightbulb className="mt-0.5 size-[18px] shrink-0 text-[#a8833f]" aria-hidden="true" />
              <span className="min-w-0">{insightSentence}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className={CARD} aria-labelledby="home-year-goals" data-testid="home-year-goals">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-year-goals" className="text-sm font-semibold">
            {fill(labels.goalsTitle, { year: String(selectedBe) })}
          </h2>
          {goals.length > 0 ? (
            <Link href="/plan/goals" className="shrink-0 text-xs font-medium text-primary">
              {labels.goalsAll}
            </Link>
          ) : null}
        </div>
        {goals.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm font-medium">{fill(labels.goalsEmpty, { year: String(selectedBe) })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.goalsEmptyHint}</p>
            <Button nativeButton={false} className="mt-3" render={<Link href="/plan/goals" />}>
              {labels.goalsCta}
            </Button>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-border/70">
            {goals.map((goal) => {
              const reached = goal.status === "completed" || goal.progress >= 100;
              const width = Math.max(0, Math.min(100, goal.progress));
              return (
                <li key={goal.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{goal.name}</p>
                    {goal.targetLabel ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{goal.targetLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {reached
                      ? labels.goalReached
                      : fill(labels.goalProgress, {
                          current: money(goal.currentCents, currencyCode),
                          target: money(goal.targetCents, currencyCode),
                        })}
                  </p>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe6d4] dark:bg-white/10"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(width)}
                    aria-label={goal.name}
                  >
                    <div className="h-full rounded-full bg-[#2f8a5b]" style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MoneyBar({
  label,
  amount,
  percent,
  amountClassName,
  fillClassName,
}: {
  label: string;
  amount: string;
  percent: number;
  amountClassName: string;
  fillClassName: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[4.75rem] shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[#efe6d4] dark:bg-white/10" aria-hidden="true">
        <div className={cn("h-full rounded-full", fillClassName)} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn("shrink-0 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap", amountClassName)}>
        {amount}
      </span>
    </div>
  );
}
