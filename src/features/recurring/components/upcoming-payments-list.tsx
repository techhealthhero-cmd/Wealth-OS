import Link from "next/link";
import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import type { CategorizedBills as UpcomingBillsSummary } from "@/lib/financial/upcoming-bills";
import type { PaymentKind } from "@/lib/financial/payment-calendar";
import { daysBetween } from "@/lib/financial/payment-calendar";
import { formatMoney } from "@/lib/financial/money";
import { cn } from "@/lib/utils";
import { KIND_ICON, KIND_TILE, formatShortDueDate, relativeDayLabel } from "@/features/recurring/lib/payment-display";

const CARD = "rounded-[20px] border bg-card text-card-foreground shadow-card";

export interface UpcomingPaymentsListProps {
  bills: UpcomingBillsSummary;
  today: string;
  locale: "th" | "en";
  currencyCode?: string;
  /** Rows shown before collapsing the rest into "N more · see list". */
  maxRows?: number;
  /** In-page anchor of the full recurring list. */
  listAnchor?: string;
  labels: Dictionary["upcomingBills"] & { calendar: Dictionary["paymentCalendar"] };
}

type Bill = UpcomingBillsSummary["overdue"][number];

function kindOf(bill: Bill): PaymentKind {
  if (bill.source === "liability") return "liability";
  return bill.type === "transfer" ? "transfer" : "expense";
}

function money(cents: number, currencyCode?: string) {
  return formatMoney(cents, currencyCode, undefined, cents % 100 === 0 ? 0 : 2);
}

/**
 * The upcoming-bills list for the recurring tab — same data, title and
 * groups (overdue / next 7 days / next 30 days) as the old
 * UpcomingBillsCard, restyled to sit under the calendar.
 */
export function UpcomingPaymentsList({
  bills,
  today,
  locale,
  currencyCode,
  maxRows = 6,
  listAnchor = "#all-recurring",
  labels,
}: UpcomingPaymentsListProps) {
  const all = [...bills.overdue, ...bills.next7Days, ...bills.next30Days];
  // Same header figure the old card showed: everything it lists.
  const totalWithin30DaysCents = all.reduce((sum, b) => sum + b.amountCents, 0);
  const groups = [
    { key: "overdue", title: labels.overdue, items: bills.overdue, tone: "text-[#9b4538] dark:text-[#f0b3a6]" },
    { key: "next7Days", title: labels.next7Days, items: bills.next7Days, tone: "text-muted-foreground" },
    { key: "next30Days", title: labels.next30Days, items: bills.next30Days, tone: "text-muted-foreground" },
  ];

  let budget = maxRows;
  const shownGroups = groups
    .map((g) => {
      const items = g.items.slice(0, Math.max(0, budget));
      budget -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length > 0);
  const hidden = all.slice(maxRows);

  const dayLabels = {
    today: labels.calendar.today,
    tomorrow: labels.calendar.tomorrow,
    inDays: labels.calendar.inDays,
    overdueDays: labels.calendar.overdueDays,
  };

  return (
    <section aria-labelledby="upcoming-payments-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="upcoming-payments-title" className="min-w-0 truncate text-[17px] leading-[26px] font-semibold">
          {labels.title}
        </h2>
        {all.length > 0 ? (
          <span className="shrink-0 text-[13px] leading-5 text-muted-foreground tabular-nums">
            {labels.calendar.within30Days.replace("{amount}", money(totalWithin30DaysCents, currencyCode))}
          </span>
        ) : null}
      </div>
      <div className={cn(CARD, "py-1")}>
        {all.length === 0 ? (
          <p className="px-4 py-3 text-sm leading-5 text-muted-foreground">{labels.noUpcoming}</p>
        ) : (
          <>
            {shownGroups.map((g) => (
              <div key={g.key}>
                <div className={cn("flex items-center justify-between px-4 pt-2.5 pb-0.5 text-xs leading-[18px] font-medium", g.tone)}>
                  <h3>{g.title}</h3>
                  <span className="font-semibold text-foreground tabular-nums">
                    {money(
                      groups.find((x) => x.key === g.key)!.items.reduce((s, b) => s + b.amountCents, 0),
                      currencyCode
                    )}
                  </span>
                </div>
                <ul>
                  {g.items.map((bill, i) => {
                    const kind = kindOf(bill);
                    const Icon = KIND_ICON[kind];
                    const days = daysBetween(today, bill.dueDate);
                    return (
                      <li key={bill.id} className={cn("flex items-center gap-3 px-4 py-[11px]", i > 0 && "border-t border-dashed")}>
                        <span className={cn("grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl", KIND_TILE[kind])}>
                          <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] leading-[22px] font-semibold">{bill.label}</p>
                          <p className="truncate text-xs leading-[18px] text-muted-foreground">
                            {formatShortDueDate(bill.dueDate, locale)} · {labels.source[bill.source]}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] leading-[22px] font-semibold tabular-nums">{money(bill.amountCents, currencyCode)}</p>
                          <span
                            className={cn(
                              "mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap",
                              days <= 0
                                ? "bg-[#f6e3dc] text-[#9b4538] dark:bg-[#e0907f]/15 dark:text-[#f0b3a6]"
                                : days <= 7
                                  ? "bg-[#f8ebd2] text-[#8a5c1f] dark:bg-[#a9732c]/20 dark:text-[#e8c48c]"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {relativeDayLabel(days, dayLabels)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {hidden.length > 0 ? (
              <div className="flex items-center justify-between gap-2 border-t border-dashed px-4 pt-2.5 pb-3 text-[13px] leading-5 text-muted-foreground">
                <span className="min-w-0 truncate">
                  {labels.calendar.moreItems.replace("{n}", String(hidden.length))} · {hidden.map((b) => b.label).join(", ")}
                </span>
                <a
                  href={listAnchor}
                  className="inline-flex shrink-0 items-center gap-1 rounded font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#8fd9b4]"
                >
                  {labels.calendar.seeInList}
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** One-line pointer to the detected-subscriptions tab, which owns that flow. */
export function DetectedSubscriptionsLink({ hint, tabTitle }: { hint: string; tabTitle: string }) {
  return (
    <Link
      href="/money/subscriptions"
      className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-[#d9c48a] bg-[#fdf3c4]/60 px-3.5 py-3 text-[13px] leading-[19px] text-[#5d5233] outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[#9c8155]/50 dark:bg-[#3a331f]/60 dark:text-[#e2cfa6]"
    >
      <Sparkles className="h-[18px] w-[18px] shrink-0 text-[#8a6d2f] dark:text-[#e2cfa6]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {hint}{" "}
        <span className="font-semibold text-primary dark:text-[#8fd9b4]">
          {tabTitle}
          <ArrowRight className="ml-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}
