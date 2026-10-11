import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";

import { getDailyInbox } from "@/features/capture/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import type { Account, Category } from "@/types/database";
import { DailyInboxCard } from "./daily-inbox-card";

/**
 * Home: a one-line nudge pointing at Money › Transactions, where the Daily
 * Inbox now lives (2026-10-11 — one page to record, review and edit).
 * Renders nothing when nothing is pending or the inbox can't load (e.g.
 * migration 0021 not applied yet), so Home stays calm.
 */
export async function DailyInboxSection() {
  const [inbox, profile] = await Promise.all([getDailyInbox(), getProfile()]);
  if (!inbox || inbox.pendingCount === 0) return null;
  const dict = getDictionary(await getLocale(profile?.preferred_language));

  return (
    <Link
      href="/money/transactions?tab=pending"
      className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-400/70 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-300"
    >
      <Inbox className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{dict.capture.inbox.homeNudge.replace("{count}", String(inbox.pendingCount))}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
        {dict.capture.inbox.homeNudgeCta}
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

/** Money › Transactions, "รอตรวจ" tab: the Daily Inbox itself (optionally one day of it). */
export async function PendingInboxSection({
  categories,
  accounts,
  onlyDate,
  emptyText,
}: {
  categories: Category[];
  accounts: Account[];
  onlyDate: string | null;
  emptyText: string;
}) {
  const inbox = await getDailyInbox();
  if (!inbox) return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return <DailyInboxCard inbox={inbox} categories={categories} accounts={accounts} onlyDate={onlyDate} emptyText={emptyText} />;
}
