import { moneyCalendarText } from "@/lib/money-calendar-text";
import { formatFriendlyDate, formatMonthHeading, formatWeekday } from "@/lib/transaction-ui";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import {
  getFinancialTransactions,
  getTransactionsPage,
  type TransactionFilters,
} from "@/features/transactions/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getDailyInbox } from "@/features/capture/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { calculateExpenses, calculateIncome } from "@/lib/financial/calculations";
import { addDaysIso, addMonthsIso, buildMonthGrid, isIsoDate, isIsoMonth, monthGridRange } from "@/lib/financial/week-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";
import { TransactionListBody } from "./transaction-list-body";
import { QuickAdd } from "./quick-add";
import { DailyInboxCard } from "@/features/capture/components/daily-inbox-card";
import { MonthHero } from "./month-hero";
import { WallCalendar } from "./wall-calendar";
import { ListTabs, type ListTab } from "./list-tabs";
import { ExportTransactionsButton } from "./export-button";
import { ExportReportButton } from "@/features/reports/components/export-report-button";

/**
 * Money › Transactions (Variant B, the monthly close-up):
 * green month hero → the full-month calendar → "ทั้งหมด | รอตรวจ" tabs →
 * the list → exports. On the pending tab the calendar hides and the review
 * list stays. A day picked on the calendar is the existing from/to filter
 * for that one date, so the list, search and paging keep working unchanged.
 */
export async function TransactionList({
  filters,
  tab = "all",
  month,
}: {
  filters: TransactionFilters;
  tab?: ListTab;
  /** The month the wall calendar shows (?month=YYYY-MM); defaults to this month. */
  month?: string;
}) {
  const isDefaultView =
    !filters.search && !filters.type && !filters.accountId && !filters.categoryId && !filters.hasNotes;
  const selectedDate = filters.from && filters.from === filters.to && isIsoDate(filters.from) ? filters.from : null;
  const profileForToday = await getProfile();
  const today = todayInTimeZone(profileForToday?.timezone ?? "Asia/Bangkok");
  const thisMonth = today.slice(0, 7);
  const calendarMonth = month && isIsoMonth(month) && month < thisMonth ? month : thisMonth;
  const calendarRange = monthGridRange(calendarMonth);
  // The summary and the list follow the calendar's month (2026-10-13): turn
  // the calendar to September and both show September, the whole month.
  const monthFrom = `${calendarMonth}-01`;
  const monthTo = addDaysIso(`${addMonthsIso(calendarMonth, 1)}-01`, -1);
  // A day picked on the calendar (or any explicit from/to) wins over the
  // month, and a search or filter still looks through all history.
  const monthScoped = !filters.from && !filters.to && isDefaultView;
  const listFilters = monthScoped ? { ...filters, from: monthFrom, to: monthTo } : filters;

  const [{ transactions, hasMore }, accounts, categories, profile, calendarTransactions, monthTransactions, budget, inbox] =
    await Promise.all([
      // Perf audit finding: this page previously fetched a user's ENTIRE
      // transaction history on every visit (getTransactions(filters) with
      // no limit) — the highest-traffic data page in the app, unbounded.
      // Only the first page renders server-side now; TransactionListBody
      // (a client component) fetches further pages on demand via the
      // loadMoreTransactions() Server Action.
      getTransactionsPage(listFilters),
      getDisplayAccounts({ includeArchived: true }),
      getCategories(),
      getProfile(),
      // Every day on the wall calendar, the neighbouring months' edge days included.
      getFinancialTransactions({ from: calendarRange.start, to: calendarRange.end }),
      getFinancialTransactions({ from: monthFrom, to: monthTo }),
      getBudgetSummary(new Date(`${monthFrom}T00:00:00`)),
      getDailyInbox(),
    ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);
  // An empty month isn't an empty history: only a user with no transactions
  // at all gets the big "start here" empty state.
  const hasAnyTransaction =
    transactions.length > 0 || !monthScoped
      ? true
      : (await getTransactionsPage({}, 0, 1)).transactions.length > 0;

  const pendingItems = (inbox?.items ?? []).filter((i) => i.review_status === "needs_review");
  const calendar = buildMonthGrid(calendarMonth, today, calendarTransactions, pendingItems.map((i) => i.transaction_date));
  const monthTitle = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthFrom}T00:00:00Z`));
  const m = dict.transactions.month;

  const monthLabels = {
    goal: m.heroGoal,
    month: m.heroMonth,
    income: m.income,
    expense: m.expense,
    net: m.net,
    budgetUsed: m.budgetUsed,
    budgetUsedShort: m.budgetUsedShort,
    budgetFoot: m.budgetFoot,
    budgetLeft: m.budgetLeft,
    budgetOver: m.budgetOver,
    previous: dict.transactions.week.previous,
    next: dict.transactions.week.next,
  };

  return (
    <div className="space-y-4">
      <MonthHero
        title={monthTitle}
        incomeCents={calculateIncome(monthTransactions)}
        expenseCents={calculateExpenses(monthTransactions)}
        budget={budget ? { percentUsed: budget.overall.percentUsed, remainingCents: budget.overall.remainingCents } : null}
        currencyCode={profile?.currency_code || "THB"}
        prevMonth={addMonthsIso(calendarMonth, -1)}
        nextMonth={calendarMonth < thisMonth ? addMonthsIso(calendarMonth, 1) : null}
        labels={monthLabels}
      />

      {tab !== "pending" && (
        <WallCalendar
          grid={calendar}
          text={moneyCalendarText(calendar, locale)}
          selectedDate={selectedDate}
          labels={{
            title: m.calendarTitle,
            tapDay: m.tapDay,
            selectedDay: m.selectedDay,
            heatSpend: dict.transactions.week.heatSpend,
            heatIncome: dict.transactions.week.heatIncome,
            hasPending: dict.transactions.week.hasPending,
            today: dict.transactions.today,
          }}
        />
      )}

      <ListTabs active={tab} pendingCount={pendingItems.length} />

      {tab === "pending" ? (
        // The pending tab is just the review list (2026-10-13): no calendar,
        // and every pending item, whatever day the "all" tab had picked.
        inbox ? (
          <DailyInboxCard
            inbox={inbox}
            categories={categories}
            accounts={accounts}
            onlyDate={null}
            emptyText={dict.transactions.pendingEmpty}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{dict.transactions.pendingEmpty}</p>
        )
      ) : (
        <>
      {transactions.length === 0 && selectedDate && isDefaultView ? (
        // One quiet day picked on the calendar: a line, not the big empty state.
        <p className="py-8 text-center text-sm text-muted-foreground">{dict.transactions.dayEmpty}</p>
      ) : transactions.length === 0 && monthScoped && hasAnyTransaction ? (
        // A quiet month turned to on the calendar: a line, not the big empty state.
        <p className="py-8 text-center text-sm text-muted-foreground">{dict.transactions.monthEmpty}</p>
      ) : transactions.length === 0 ? (
        isDefaultView && !filters.from && !filters.to ? (
          // Genuinely zero transactions ever — explain why this matters and
          // give one obvious action, per UX_GUIDELINES.md #10. Reuses the
          // same QuickAdd already rendered above the list, so there's no
          // second transaction-entry mechanism to maintain.
          <EmptyState
            illustration={<EmptyTransactionsIllustration size={140} />}
            title={dict.transactions.emptyTitle}
            description={dict.transactions.emptyDescription}
            action={<QuickAdd accounts={accounts} categories={categories} variant="inline" />}
          />
        ) : (
          // Filters/search are active and matched nothing — a different,
          // honest message: transactions DO exist, just not matching this
          // filter. Showing "No transactions yet" here would be false.
          <EmptyState
            illustration={<EmptyTransactionsIllustration size={140} />}
            title={dict.transactions.noResultsTitle}
            description={dict.transactions.noTransactionsFound}
          />
        )
      ) : (
        <TransactionListBody
          // Remount when the filters change (e.g. a day picked on the calendar):
          // the body copies its first page into state, so without a new key
          // it would keep showing the previous filter's rows.
          key={JSON.stringify(listFilters)}
          today={today}
          dateText={Object.fromEntries(transactions.map(tx => {
            const date = tx.transaction_date.slice(0, 10);
            return [date, { friendly: formatFriendlyDate(date, locale, { today: dict.transactions.today, yesterday: dict.transactions.yesterday }, today), weekday: formatWeekday(date, locale), month: formatMonthHeading(date.slice(0, 7), locale) }];
          }))}
          initialTransactions={transactions}
          initialHasMore={hasMore}
          filters={listFilters}
          accounts={accounts}
          categories={categories}
          defaultDetailsOpen={filters.hasNotes}
          // The calendar above already names its month.
          unlabeledMonth={calendarMonth}
        />
      )}

      {/* The filter row was removed (2026-10-12); the rarely used exports
          that lived behind its "⋯" pill now sit quietly under the list. */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <ExportTransactionsButton />
        <ExportReportButton />
      </div>
        </>
      )}
    </div>
  );
}
