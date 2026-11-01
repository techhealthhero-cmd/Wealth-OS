/**
 * Where the journal still turns like paper.
 *
 * Home keeps the page curl (swipe forward to the next page). Closing the
 * notebook is a separate cover animation and is not decided here. Every
 * other route — Money, Plan, Earn, their inner tabs, settings — changes
 * with a short fade and never builds a curl sheet.
 */
export type PageTurnStyle = "curl" | "fade";

export function pageTurnStyle(scope: "home" | "section"): PageTurnStyle {
  return scope === "home" ? "curl" : "fade";
}
