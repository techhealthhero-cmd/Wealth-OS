/**
 * The day Quick Capture records into. Defaults to today; the user can pick
 * an earlier day (catching up on yesterday or 30 ก.ย.). Pure helpers.
 */

/** How far back the date wheel scrolls; older days use the calendar. */
export const CAPTURE_WHEEL_DAYS = 90;

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** `days` dates ending at `today`, oldest first — the wheel's rows (today at the bottom). */
export function recentCaptureDates(today: string, days = CAPTURE_WHEEL_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => shift(today, i - (days - 1)));
}

/**
 * The date an item is saved with. Words in the sentence ("เมื่อวาน") win;
 * otherwise — the parser fell back to today — the chosen day applies.
 */
export function applyCaptureDate(parsedDate: string, realToday: string, chosenDate: string): string {
  return parsedDate === realToday ? chosenDate : parsedDate;
}

/** A chosen day is valid only if it's a real date and not in the future. */
export function isValidCaptureDate(date: string, realToday: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return false;
  return date <= realToday;
}
