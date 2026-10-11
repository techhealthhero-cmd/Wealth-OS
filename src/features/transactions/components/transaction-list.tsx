import { Suspense } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";

import { getDisplayAccounts } from "@/features/accounts/queries";
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
import { calculateWeeklyCheckInStatus } from "@/lib/financial/streaks";
import { EmptyState } from "@/components/shared/empty-state";
import { EmptyTransactionsIllustration } from "@/components/illustrations";
import { TransactionListBody } from "./transaction-list-body";
import { TransactionFilters as TransactionFiltersBar } from "./transaction-filters";
import { QuickAdd } from "./quick-add";
import { PendingInboxSection } from "@/features/capture/components/daily-inbox-section";
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
      getDisplayAccounts({ includeArchived: true }),
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

  // The three "how to update" bullets + step list, shared by the full note
  // and the folded one-line version shown once this week is up to date.
  const reminderDetails = (
    <>
      <p className="text-sm leading-relaxed text-foreground/80">{dict.transactions.weeklyReminderDescription}</p>
      <ul className="grid gap-2 text-sm leading-relaxed sm:grid-cols-3">
        <li>{dict.transactions.weeklyReminderIncome}</li>
        <li>{dict.transactions.weeklyReminderExpense}</li>
        <li>{dict.transactions.weeklyReminderTransfer}</li>
      </ul>
      <details className="group/how text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-1 font-medium underline-offset-2 hover:underline">
          {dict.transactions.weeklyReminderHowToTitle}
          <ChevronDown className="size-3.5 shrink-0 transition-transform group-open/how:rotate-180" aria-hidden="true" />
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
    </>
  );

  return (
    <div className="space-y-4">
      {/* 2026-10-11 "one page for money in/out": this page is where every
          income, expense and transfer is recorded, reviewed and edited.
          Order: add → review what's pending → reminder → find → list. */}
      <QuickAdd accounts={accounts} categories={categories} variant="record" />

      {isDefaultView ? (
        // The Daily Inbox (moved here from Home). Renders nothing when
        // nothing needs review; no skeleton for a box that's usually absent.
        <Suspense fallback={null}>
          <PendingInboxSection categories={categories} accounts={accounts} />
        </Suspense>
      ) : null}

      {/* The weekly note only shows while there's something to catch up on;
          once this week is recorded it stays out of the way. */}
      {!isUpToDate ? (
        <aside
          aria-labelledby="weekly-transaction-reminder-title"
          // Journal (2026-10-08): a taped sticky note. Up-to-date vs. needs-update
          // stays clear from the icon + status text, never from the note color.
          className="journal-note journal-tape mt-2 rounded-md p-4 pt-5 text-foreground"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <CircleAlert className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 id="weekly-transaction-reminder-title" className="font-heading font-medium">
                  {dict.transactions.weeklyReminderTitle}
                </h2>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{statusText}</span>
              </div>
              {reminderDetails}
            </div>
          </div>
        </aside>
      ) : null}

      {/* Search, filters and the rarely used exports ("⋯") share one row. */}
      <TransactionFiltersBar
        accounts={accounts}
        categories={categories}
        moreActions={
          <>
            <ExportTransactionsButton />
            <ExportReportButton />
          </>
        }
      />

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
