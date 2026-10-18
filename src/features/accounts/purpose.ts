/**
 * "What this money is for" — the label on the back of a flipped account card
 * (accounts.purpose, migration 0045). The quick-pick presets live in the
 * dictionaries as accounts.purposePresets[0..5]; each index has its own pill
 * colour so the same kind of money looks the same on every card.
 */
export const PURPOSE_PRESET_INDEXES = [0, 1, 2, 3, 4, 5] as const;

// Indexes match accounts.purposePresets: daily · savings · emergency ·
// long-term investing · regular bills · saving for a goal.
const PRESET_PILL = [
  "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  "bg-lime-100 text-lime-900 dark:bg-lime-400/15 dark:text-lime-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-400/15 dark:text-violet-200",
] as const;

const PLAIN_PILL = "bg-muted text-muted-foreground";

/**
 * The pill colour for a purpose: a preset's own colour when the text is one of
 * `presets` (the current language's preset labels), otherwise plain.
 */
export function purposePillClass(purpose: string, presets: readonly string[]): string {
  const index = presets.indexOf(purpose.trim());
  return index >= 0 && index < PRESET_PILL.length ? PRESET_PILL[index] : PLAIN_PILL;
}
