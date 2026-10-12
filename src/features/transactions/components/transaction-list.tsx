import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import {
  getQuickRepeatCandidates,
  getTransactions,
  getTransactionsPage,
  type TransactionFilters,
} from "@/features/transactions/queries";
import { getBudgetSummary } from "@/features/budget/queries";
import { getDailyInbox } from "@/features/capture/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { calculateExpenses, calculateIncome } from "@/lib/financial/calculations";
import { addDaysIso, buildWeekStrip, isIsoDate } from "@/lib/financial/week-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";
import { TransactionListBody } from "./transaction-list-body";
import { QuickAdd } from "./quick-add";
import { DailyInboxCard } from "@/features/capture/components/daily-inbox-card";
import { MonthSummary } from "./month-summary";
import { WeekStrip } from "./week-strip";
import { ListTabs, type ListTab } from "./list-tabs";
import { QuickRepeat } from "./quick-repeat";
import { ExportTransactionsButton } from "./export-button";
import { ExportReportButton } from "@/features/reports/components/export-report-button";

/**
 * Money › Transactions (2026-10-11, mockup "B + D"): add → this month at a
 * glance → the 7-day strip → "ทั้งหมด | รอตรวจ" tabs → the list (or the
 * pending review list). A day picked on the strip is just the existing
 * from/to filter set to that one date, so the list, search and paging all
 * keep working unchanged.
 */
export async function TransactionList({
  filters,
  tab = "all",
  week,
}: {
  filters: TransactionFilters;
  tab?: ListTab;
  /** First day of the 7 the strip shows (?week=); defaults to the last 7 days ending today. */
  week?: string;
}) {
  const isDefaultView =
    !filters.search && !filters.type && !filters.accountId && !filters.categoryId && !filters.hasNotes;
  const selectedDate = filters.from && filters.from === filters.to && isIsoDate(filters.from) ? filters.from : null;
  const profileForToday = await getProfile();
  const today = todayInTimeZone(profileForToday?.timezone ?? "Asia/Bangkok");
  // A rolling 7 days with today at the right end — on a Monday a calendar
  // week would be six empty future days.
  const latestStart = addDaysIso(today, -6);
  const weekStart = week && isIsoDate(week) && week < latestStart ? week : latestStart;
  const monthFrom = `${today.slice(0, 7)}-01`;
  const monthTo = addDaysIso(`${addDaysIso(monthFrom, 32).slice(0, 7)}-01`, -1);

  const [{ transactions, hasMore }, accounts, categories, profile, quickRepeatCandidates, weekTransactions, monthTransactions, budget, inbox] =
    await Promise.all([
      // Perf audit finding: this page previously fetched a user's ENTIRE
      // transaction history on every visit (getTransactions(filters) with
      // no limit) — the highest-traffic data page in the app, unbounded.
      // Only the first page renders server-side now; TransactionListBody
      // (a client component) fetches further pages on demand via the
      // loadMoreTransactions() Server Action.
      getTransactionsPage(filters),
      getDisplayAccounts({ includeArchived: true }),
      getCategories(),
      getProfile(),
      isDefaultView ? getQuickRepeatCandidates() : Promise.resolve([]),
      getTransactions({ from: weekStart, to: addDaysIso(weekStart, 6) }),
      getTransactions({ from: monthFrom, to: monthTo }),
      getBudgetSummary(new Date(`${monthFrom}T00:00:00`)),
      getDailyInbox(),
    ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const pendingItems = (inbox?.items ?? []).filter((i) => i.review_status === "needs_review");
  const weekDays = buildWeekStrip(weekStart, today, weekTransactions, pendingItems.map((i) => i.transaction_date));
  const monthTitle = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthFrom}T00:00:00Z`));
  const m = dict.transactions.month;

  return (
    <div className="space-y-4">
      <QuickAdd accounts={accounts} categories={categories} variant="row" />

      <MonthSummary
        title={monthTitle}
        incomeCents={calculateIncome(monthTransactions)}
        expenseCents={calculateExpenses(monthTransactions)}
        budget={budget ? { percentUsed: budget.overall.percentUsed, remainingCents: budget.overall.remainingCents } : null}
        labels={{ income: m.income, expense: m.expense, left: m.left, budgetUsed: m.budgetUsed, budgetLeft: m.budgetLeft, budgetOver: m.budgetOver }}
      />

      <ListTabs active={tab} pendingCount={pendingItems.length} />

      {/* The 7-day strip sits right under the tabs (2026-10-12). */}
      <WeekStrip
        days={weekDays}
        prevWeek={addDaysIso(weekStart, -7)}
        nextWeek={weekStart < latestStart ? (addDaysIso(weekStart, 7) < latestStart ? addDaysIso(weekStart, 7) : latestStart) : null}
        selectedDate={selectedDate}
      />

      {tab === "pending" ? (
        inbox ? (
          <DailyInboxCard
            inbox={inbox}
            categories={categories}
            accounts={accounts}
            onlyDate={selectedDate}
            emptyText={selectedDate ? dict.transactions.pendingEmptyDay : dict.transactions.pendingEmpty}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{dict.transactions.pendingEmpty}</p>
        )
      ) : (
        <>
      {isDefaultView && !selectedDate ? (
        <QuickRepeat candidates={quickRepeatCandidates} accounts={accounts} categories={categories} />
      ) : null}

      {transactions.length === 0 && selectedDate && isDefaultView ? (
        // One quiet day picked on the strip: a line, not the big empty state.
        <p className="py-8 text-center text-sm text-muted-foreground">{dict.transactions.dayEmpty}</p>
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
          initialTransactions={transactions}
          initialHasMore={hasMore}
          filters={filters}
          accounts={accounts}
          categories={categories}
          defaultDetailsOpen={filters.hasNotes}
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
