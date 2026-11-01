import Link from "next/link";

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

/** Quiet paper section: hairline on the cream page, no slip card. */
const SECTION = "border-t border-[#e9dfca] pt-5 pb-1.5 dark:border-white/10";
/** Selected year and the savings figure. Darkened just enough to clear 4.5:1 on cream. */
const GOLD = "text-[#80602a] dark:text-[#e2c57a]";

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
    <div data-testid="home-year">
      <section className={SECTION} aria-labelledby="home-year-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="home-year-title" className="text-[13px] font-medium text-muted-foreground">
            {labels.title}
          </h2>
          {throughMonth ? (
            <span className="shrink-0 text-[13px] text-muted-foreground">
              {fill(labels.through, { month: throughMonth })}
            </span>
          ) : null}
        </div>

        <nav aria-label={labels.yearSwitcher} className="mt-1">
          <ul className="flex gap-[18px]">
            {options.map((option) => {
              const selected = option.gregorian === selectedYear;
              return (
                <li key={option.buddhist}>
                  <Link
                    href={option.href}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? cn("border-b-[1.5px] border-[#80602a] pb-0.5 font-semibold dark:border-[#e2c57a]", GOLD) : "text-muted-foreground",
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
            <div className="mt-1 space-y-2.5" aria-label={fill(labels.barsLabel, { year: String(selectedBe) })}>
              <MoneyBar
                label={labels.income}
                amount={money(incomeCents, currencyCode)}
                percent={barPercent(incomeCents, maxBar)}
                fillClassName="bg-[#4f7a62]"
              />
              <MoneyBar
                label={labels.expense}
                amount={money(expenseCents, currencyCode)}
                percent={barPercent(expenseCents, maxBar)}
                fillClassName="bg-[#c49a86]"
              />
            </div>
            <div className="mt-3.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">{fill(labels.saved, { year: String(selectedBe) })}</span>
              <span className={cn("font-semibold tabular-nums", GOLD)}>{money(savedCents, currencyCode)}</span>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-sm font-medium">{fill(labels.emptyYear, { year: String(selectedBe) })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.emptyYearHint}</p>
            <Button nativeButton={false} className="mt-3" render={<Link href="/money/transactions" />}>
              {labels.emptyYearCta}
            </Button>
          </div>
        )}
      </section>

      {showMoney && categories.length > 0 ? (
        <section className={SECTION} aria-labelledby="home-year-categories" data-testid="home-year-categories">
          <h2 id="home-year-categories" className="text-[13px] font-medium text-muted-foreground">
            {labels.categoryTitle}
          </h2>
          <table className="mt-3 w-full table-fixed text-[13px]">
            <caption className="sr-only">{labels.categoryTitle}</caption>
            <thead>
              <tr className="border-t border-[#efe6d3] text-muted-foreground dark:border-white/10">
                <th scope="col" className="py-2 text-left font-normal">
                  {labels.category}
                </th>
                <th scope="col" className="w-16 py-2 text-right font-normal text-foreground">
                  {selectedBe}
                </th>
                <th scope="col" className="w-16 py-2 text-right font-normal">
                  {previousBe}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t border-[#efe6d3] dark:border-white/10">
                  <th scope="row" className="max-w-0 py-2 text-left font-normal">
                    <span className="block truncate">{category.label}</span>
                  </th>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {money(category.currentCents, currencyCode)}
                  </td>
                  <td className="py-2 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                    {money(category.previousCents, currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {insightSentence ? <p className="mt-3 text-[13px] leading-5 text-muted-foreground">{insightSentence}</p> : null}
        </section>
      ) : null}

      <section className={SECTION} aria-labelledby="home-year-goals" data-testid="home-year-goals">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="home-year-goals" className="text-[13px] font-medium text-muted-foreground">
            {fill(labels.goalsTitle, { year: String(selectedBe) })}
          </h2>
          {goals.length > 0 ? (
            <Link href="/plan/goals" className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium text-[#80602a] dark:text-[#e2c57a]">
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
          <ul className="mt-2 divide-y divide-[#efe6d3] dark:divide-white/10">
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
                    className="mt-2 h-[3px] overflow-hidden rounded-sm bg-[#ebe1cc] dark:bg-white/10"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(width)}
                    aria-label={goal.name}
                  >
                    <div className="h-full rounded-sm bg-[#4f7a62]" style={{ width: `${width}%` }} />
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
  fillClassName,
}: {
  label: string;
  amount: string;
  percent: number;
  fillClassName: string;
}) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-[3px] overflow-hidden rounded-sm bg-[#ebe1cc] dark:bg-white/10" aria-hidden="true">
        <div className={cn("h-full rounded-sm", fillClassName)} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-right tabular-nums whitespace-nowrap text-foreground">{amount}</span>
    </div>
  );
}
