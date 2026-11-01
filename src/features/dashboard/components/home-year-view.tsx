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
  /** "ปี {year} ยังไม่มีบันทึก (฿0 ทุกหมวด)" */
  noPreviousYear: string;
  /** "ภายใน {date}" */
  goalBy: string;
  /** "ปี {year} {amount}" */
  previousYearAmount: string;
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
  /** Mali class from next/font. Empty in tests that render the view alone. */
  handClassName?: string;
}

const INK = "text-[#1f3a2c] dark:text-[#f3ead7]";
const GOLD = "text-[#8a6a2f] dark:text-[#e2c57a]";
const INCOME = "text-[#2f6a4c] dark:text-[#b7d7c4]";
/** Highlighter behind the lower half of a handwritten heading. */
const MARKER = "bg-[linear-gradient(transparent_60%,var(--journal-highlight)_60%)]";

function money(cents: number, currencyCode: string): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return formatMoney(Math.abs(cents), currencyCode, currencyCode === "THB" ? "th-TH" : undefined, digits);
}

/** Unicode minus, never a red style. Positive amounts have no sign. */
function plainMoney(cents: number, currencyCode: string): string {
  const abs = money(cents, currencyCode);
  return cents < 0 ? `−${abs}` : abs;
}

function ledgerMoney(cents: number, currencyCode: string, role: "income" | "expense" | "saved"): string {
  const abs = money(cents, currencyCode);
  if (role === "income") {
    if (cents > 0) return `+${abs}`;
    if (cents < 0) return `−${abs}`;
    return abs;
  }
  if (role === "expense") {
    if (cents > 0) return `−${abs}`;
    if (cents < 0) return `+${abs}`;
    return abs;
  }
  return cents < 0 ? `−${abs}` : abs;
}

/** Bar width and the printed share, both relative to the largest category. */
function shareOfMax(cents: number, max: number): { width: number; label: string } {
  if (cents <= 0 || max <= 0) return { width: 0, label: "0%" };
  const raw = (cents / max) * 100;
  const width = Math.min(100, raw < 4 ? 4 : raw);
  const label = raw < 0.5 ? "<1%" : `${Math.round(raw)}%`;
  return { width, label };
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function NotebookHeading({
  id,
  text,
  handClassName,
  pencil = false,
}: {
  id: string;
  text: string;
  handClassName: string;
  pencil?: boolean;
}) {
  const splitAt = text.indexOf(" · ");
  const lead = splitAt === -1 ? text : text.slice(0, splitAt);
  const rest = splitAt === -1 ? "" : text.slice(splitAt);
  return (
    <h2
      id={id}
      className={cn(
        handClassName,
        "origin-left -rotate-1 text-[21px] leading-tight font-bold motion-reduce:transform-none",
        INK,
      )}
    >
      <span className={MARKER}>{lead}</span>
      {rest}
      {pencil ? (
        <span aria-hidden="true" className="ml-1.5 inline-block text-[0.75em] font-normal">
          ✎
        </span>
      ) : null}
    </h2>
  );
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
  handClassName = "",
}: HomeYearViewProps) {
  const selectedBe = buddhistYear(selectedYear);
  const previousBe = buddhistYear(selectedYear - 1);
  const showMoney = incomeCents !== 0 || expenseCents !== 0 || categories.length > 0;
  const previousAllZero = categories.every((category) => category.previousCents === 0);
  const maxCategory = Math.max(0, ...categories.map((category) => category.currentCents));
  const insightYear = locale === "th" ? String(selectedBe).slice(-2) : String(selectedBe);
  const insightPrevious = locale === "th" ? String(previousBe).slice(-2) : String(previousBe);
  const insightSentence = insight
    ? fill(insight.direction === "up" ? labels.insightUp : labels.insightDown, {
        category: insight.label,
        year: insightYear,
        previous: insightPrevious,
        from: plainMoney(insight.previousCents, currencyCode),
        to: plainMoney(insight.currentCents, currencyCode),
      })
    : null;

  return (
    <div data-testid="home-year" className="pt-2 text-[#26332d] dark:text-foreground">
      <section aria-labelledby="home-year-title">
        <NotebookHeading id="home-year-title" text={labels.title} handClassName={handClassName} pencil />

        <div className="mt-1 flex flex-wrap items-center gap-x-[18px] gap-y-1">
          <nav aria-label={labels.yearSwitcher}>
            <ul className="flex items-center gap-[18px]">
              {options.map((option) => {
                const selected = option.gregorian === selectedYear;
                return (
                  <li key={option.buddhist}>
                    <Link
                      href={option.href}
                      aria-current={selected ? "true" : undefined}
                      className="inline-flex h-11 items-center px-0.5 text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          selected
                            ? cn("rounded-full border-[1.5px] border-[#8a6a2f] px-2 py-px font-semibold dark:border-[#e2c57a]", GOLD)
                            : "text-muted-foreground",
                        )}
                      >
                        {option.buddhist}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {throughMonth ? (
            <span className="text-[12.5px] text-muted-foreground">{fill(labels.through, { month: throughMonth })}</span>
          ) : null}
        </div>

        {showMoney ? (
          <div className="mt-1" aria-label={fill(labels.barsLabel, { year: String(selectedBe) })}>
            <div className="flex h-8 items-center justify-between text-sm">
              <span>{labels.income}</span>
              <span data-testid="home-year-income" className={cn("font-semibold tabular-nums", INCOME)}>
                {ledgerMoney(incomeCents, currencyCode, "income")}
              </span>
            </div>
            <div className="flex h-8 items-center justify-between text-sm">
              <span>{labels.expense}</span>
              <span data-testid="home-year-expense" className="font-semibold text-foreground tabular-nums">
                {ledgerMoney(expenseCents, currencyCode, "expense")}
              </span>
            </div>
            <div className="flex h-8 items-center justify-between border-t-2 border-[#1f3a2c] text-sm dark:border-[#e7d7b0]">
              <span>{fill(labels.saved, { year: String(selectedBe) })}</span>
              <span
                data-testid="home-year-saved"
                className={cn(
                  "font-semibold underline decoration-double underline-offset-[3px] tabular-nums",
                  GOLD,
                )}
              >
                {ledgerMoney(savedCents, currencyCode, "saved")}
              </span>
            </div>
          </div>
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
        <section
          className="mt-6"
          aria-labelledby="home-year-categories"
          data-testid="home-year-categories"
          data-previous={previousAllZero ? "false" : "true"}
        >
          <NotebookHeading id="home-year-categories" text={labels.categoryTitle} handClassName={handClassName} />
          {previousAllZero ? (
            <p data-testid="home-year-no-previous" className="mt-1 mb-1 text-[12.5px] text-muted-foreground">
              {fill(labels.noPreviousYear, { year: String(previousBe) })}
            </p>
          ) : null}
          <ul className="mt-1">
            {categories.map((category) => {
              const share = shareOfMax(category.currentCents, maxCategory);
              const current = plainMoney(category.currentCents, currencyCode);
              const previous = plainMoney(category.previousCents, currencyCode);
              return (
                <li key={category.id} className="text-[13px]">
                  <div className="flex h-8 items-center gap-2">
                    <span className="max-w-[46%] shrink-0 truncate">{category.label}</span>
                    <span
                      className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-[rgba(201,161,90,0.15)] dark:bg-white/10"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-[linear-gradient(90deg,#c9a15a,#e9cf7a)]"
                        style={{ width: `${share.width}%` }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums">{share.label}</span>
                    <span className="shrink-0 text-right font-medium tabular-nums whitespace-nowrap">{current}</span>
                  </div>
                  {previousAllZero || category.previousCents === 0 ? null : (
                    <p className="h-8 text-right text-[12.5px] leading-8 text-muted-foreground tabular-nums">
                      {fill(labels.previousYearAmount, { year: String(previousBe), amount: previous })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {insightSentence ? <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{insightSentence}</p> : null}
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="home-year-goals" data-testid="home-year-goals">
        <div className="flex items-start justify-between gap-3">
          <NotebookHeading
            id="home-year-goals"
            text={fill(labels.goalsTitle, { year: String(selectedBe) })}
            handClassName={handClassName}
          />
          {goals.length > 0 ? (
            <Link
              href="/plan/goals"
              className={cn("inline-flex min-h-11 shrink-0 items-center text-xs font-medium", GOLD)}
            >
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
          <ul className="mt-3 space-y-4">
            {goals.map((goal, index) => {
              const reached = goal.status === "completed" || goal.progress >= 100;
              const width = Math.max(0, Math.min(100, goal.progress));
              const progress = reached
                ? labels.goalReached
                : fill(labels.goalProgress, {
                    current: plainMoney(goal.currentCents, currencyCode),
                    target: plainMoney(goal.targetCents, currencyCode),
                  });
              const by = goal.targetLabel ? fill(labels.goalBy, { date: goal.targetLabel }) : null;
              return (
                <li key={goal.id}>
                  <div
                    data-testid="home-year-goal-note"
                    className={cn(
                      "journal-note journal-tape relative mx-2 px-4 pt-4 pb-3.5 motion-reduce:transform-none",
                      index % 2 === 0 ? "rotate-[1.2deg]" : "-rotate-[0.8deg]",
                    )}
                  >
                    <p className={cn(handClassName, "text-[17px] leading-snug font-bold", INK)}>{goal.name}</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground tabular-nums">
                      {by ? `${progress} · ${by}` : progress}
                    </p>
                    <div
                      className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgba(138,106,47,0.2)]"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(width)}
                      aria-label={goal.name}
                    >
                      {width > 0 ? (
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#c9a15a,#e9cf7a)]"
                          style={{ width: `${width}%` }}
                        />
                      ) : null}
                    </div>
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
