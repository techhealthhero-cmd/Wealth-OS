/**
 * Daily Inbox review rules — pure, shared by the inbox card and the confirm
 * action so "why does this need review" and "may this be bulk-confirmed /
 * learned from" can never disagree.
 */

interface CategoryLike {
  id: string;
  name_en: string;
  is_system: boolean;
}

interface InboxItemLike {
  category_id: string | null;
  source: string | null;
  ai_confidence: "high" | "medium" | "low" | null;
}

/**
 * No category, or the system "Other" the parser falls back to when it has
 * no idea — i.e. the category is still undecided, not a real choice.
 */
export function isUndecidedCategory(categoryId: string | null, categories: readonly CategoryLike[]): boolean {
  if (!categoryId) return true;
  const category = categories.find((c) => c.id === categoryId);
  return !category || (category.is_system && category.name_en === "Other");
}

export type InboxReviewReason = "category" | "scan" | "details";

/** Why an item is waiting — shown on the card so the user knows what to check. */
export function inboxReviewReasons(item: InboxItemLike, categories: readonly CategoryLike[]): InboxReviewReason[] {
  const reasons: InboxReviewReason[] = [];
  if (isUndecidedCategory(item.category_id, categories)) reasons.push("category");
  if (item.source === "receipt" && item.ai_confidence !== "high") reasons.push("scan");
  if (reasons.length === 0) reasons.push("details");
  return reasons;
}

/**
 * "Confirm all" only confirms items that are complete. An item whose
 * category is still undecided needs a real pick first — bulk-confirming it
 * would file it as "Other" and silently hide it from review.
 */
export function canBulkConfirm(item: InboxItemLike, categories: readonly CategoryLike[]): boolean {
  return !isUndecidedCategory(item.category_id, categories);
}
