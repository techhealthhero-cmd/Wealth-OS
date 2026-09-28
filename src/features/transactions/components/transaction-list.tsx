import { ChevronDown, CircleAlert, CircleCheck, History } from "lucide-react";

import { getAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import {
  getLatestTransactionDate,
  getQuickRepeatCandidates,
  getTransactionsPage,
  type TransactionFilters,
} from "@/features/transactions/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { calculateWeeklyCheckInStatus } from "@/lib/financial/streaks";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";
import { TransactionListBody } from "./transaction-list-body";
import { TransactionFilters as TransactionFiltersBar } from "./transaction-filters";
import { QuickAdd } from "./quick-add";
import { QuickRepeat } from "./quick-repeat";
import { ExportTransactionsButton } from "./export-button";
import { ExportReportButton } from "@/features/reports/components/export-report-button";

export async function TransactionList({ filters }: { filters: TransactionFilters }) {
  const isDefaultView =
    !filters.search && !filters.type && !filters.accountId && !filters.categoryId && !filters.hasNotes;
  const [{ transactions, hasMore }, accounts, categories, profile, quickRepeatCandidates, latestTransactionDate] =
    await Promise.all([
      // Perf audit finding: this page previously fetched a user's ENTIRE
      // transaction history on every visit (getTransactions(filters) with
      // no limit) — the highest-traffic data page in the app, unbounded.
      // Only the first page renders server-side now; TransactionListBody
      // (a client component) fetches further pages on demand via the
      // loadMoreTransactions() Server Action.
      getTransactionsPage(filters),
      getAccounts({ includeArchived: true }),
      getCategories(),
      getProfile(),
      isDefaultView ? getQuickRepeatCandidates() : Promise.resolve([]),
      // Deliberately unfiltered — see getLatestTransactionDate()'s own doc
      // comment — so this stays accurate regardless of the active filters
      // above, and always answers "where did I actually leave off."
      getLatestTransactionDate(),
    ]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const weeklyStatus = calculateWeeklyCheckInStatus(
    latestTransactionDate ? new Date(latestTransactionDate) : null
  );
  const statusText =
    latestTransactionDate === null
      ? dict.transactions.weeklyReminderStatusNever
      : weeklyStatus.isDoneThisWeek
        ? dict.transactions.weeklyReminderStatusDone
        : (weeklyStatus.pendingDays === 1
            ? dict.transactions.weeklyReminderStatusPendingOne
            : dict.transactions.weeklyReminderStatusPendingOther
          ).replace("{days}", String(weeklyStatus.pendingDays));
  const isUpToDate = latestTransactionDate !== null && weeklyStatus.isDoneThisWeek;

  const activeAccountNames = accounts.filter((a) => !a.is_archived).map((a) => a.name);
  const accountsList = new Intl.ListFormat(locale === "th" ? "th" : "en", {
    style: "long",
    type: "conjunction",
  }).format(activeAccountNames);

  return (
    <div className="space-y-4">
      {/* Moved here from the dashboard's floating "+" (which overlapped the
          bottom nav's rightmost tab after the nav's floating-pill redesign,
          and duplicated the row of income/expense/transfer tiles already on
          that page) — this is the actual "add a transaction" screen, a more
          natural home for it. The row/inline QuickAdd instances further down
          this page stay as they were; this is the one additional floating
          instance. */}
      <QuickAdd accounts={accounts} categories={categories} />
      <aside
        aria-labelledby="weekly-transaction-reminder-title"
        className={
          isUpToDate
            ? "rounded-xl border border-emerald-500/25 bg-emerald-50/70 p-4 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100"
            : "rounded-xl border border-amber-500/25 bg-amber-50/70 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isUpToDate
                ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300"
            }
          >
            {isUpToDate ? (
              <CircleCheck className="size-5" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 id="weekly-transaction-reminder-title" className="font-heading font-medium">
                  {dict.transactions.weeklyReminderTitle}
                </h2>
                <span
                  className={
                    isUpToDate
                      ? "text-xs font-medium text-emerald-700 dark:text-emerald-300"
                      : "text-xs font-medium text-amber-700 dark:text-amber-300"
                  }
                >
                  {statusText}
                </span>
              </div>
              <p
                className={
                  isUpToDate
                    ? "text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-100/75"
                    : "text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/75"
                }
              >
                {dict.transactions.weeklyReminderDescription}
              </p>
            </div>
            <ul className="grid gap-2 text-sm leading-relaxed sm:grid-cols-3">
              <li>{dict.transactions.weeklyReminderIncome}</li>
              <li>{dict.transactions.weeklyReminderExpense}</li>
              <li>{dict.transactions.weeklyReminderTransfer}</li>
            </ul>
            <details className="group text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium underline-offset-2 hover:underline">
                {dict.transactions.weeklyReminderHowToTitle}
                <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed">
                <li>
                  {activeAccountNames.length > 0
                    ? dict.transactions.weeklyReminderStep1WithAccounts.replace("{accounts}", accountsList)
                    : dict.transactions.weeklyReminderStep1NoAccounts}
                </li>
                <li>{dict.transactions.weeklyReminderStep2}</li>
                <li>{dict.transactions.weeklyReminderStep3}</li>
              </ol>
            </details>
          </div>
        </div>
      </aside>

      {latestTransactionDate ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="size-3.5 shrink-0" aria-hidden="true" />
          {dict.transactions.latestEntry.replace(
            "{date}",
            formatFriendlyDate(latestTransactionDate, locale, {
              today: dict.transactions.today,
              yesterday: dict.transactions.yesterday,
            })
          )}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TransactionFiltersBar accounts={accounts} categories={categories} />
        <div className="flex shrink-0 items-center gap-2">
          <ExportTransactionsButton />
          <ExportReportButton />
          <QuickAdd accounts={accounts} categories={categories} variant="inline" />
        </div>
      </div>

      {isDefaultView ? (
        <QuickRepeat candidates={quickRepeatCandidates} accounts={accounts} categories={categories} />
      ) : null}

      {transactions.length === 0 ? (
        isDefaultView ? (
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
    </div>
  );
}
