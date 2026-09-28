import { getDailyInbox } from "@/features/capture/queries";
import type { Account, Category } from "@/types/database";
import { DailyInboxCard } from "./daily-inbox-card";

/**
 * Server wrapper for the Home dashboard. Renders nothing when there's
 * nothing to show (no captures today and nothing pending) or when the
 * inbox can't load (e.g. migration 0021 not applied yet) — Home stays calm
 * instead of showing an empty or broken card.
 */
export async function DailyInboxSection({ categories, accounts }: { categories: Category[]; accounts: Account[] }) {
  const inbox = await getDailyInbox();
  if (!inbox || inbox.items.length === 0) return null;
  return <DailyInboxCard inbox={inbox} categories={categories} accounts={accounts} />;
}
