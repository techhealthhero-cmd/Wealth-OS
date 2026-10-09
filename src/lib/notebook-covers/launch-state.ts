/**
 * Launch-level guard for the notebook opening (client only).
 *
 * Module scope lives exactly as long as the JavaScript document: it survives
 * route changes, remounts, data refreshes and the app coming back from the
 * background, and is reset only by a new document load — which is precisely
 * the brief's definition of a "fresh app launch" (new tab, new PWA session,
 * or a full reload). No storage involved, so no stale state across launches
 * and no assumptions about the iOS PWA process lifecycle.
 *
 * Never written during render (only from effects / event handlers), so the
 * server — where this module is shared between requests — always sees
 * `false`.
 */
let launchHandled = false;

export function isLaunchHandled(): boolean {
  return launchHandled;
}

export function markLaunchHandled(): void {
  launchHandled = true;
}
