/**
 * How a journal page changes.
 *
 * Every route fades, including a swipe from Home to Money. Closing the
 * notebook (swipe back on Home) and opening the cover are separate
 * animations and are not decided here. No page turn builds a curl sheet.
 */
export type PageTurnStyle = "curl" | "fade";

const PAGE_TURN_STYLE = {
  home: "fade",
  section: "fade",
} as const satisfies Record<"home" | "section", PageTurnStyle>;

export function pageTurnStyle(scope: "home" | "section"): PageTurnStyle {
  return PAGE_TURN_STYLE[scope];
}
