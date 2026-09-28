"use client";

import { useEffect, useState } from "react";

import { captureError } from "@/lib/observability";
import { Button } from "@/components/ui/button";

// Reported: this page often appeared for a transient failure (e.g. one of
// several independent per-request Supabase Auth/data calls hitting a brief
// rate-limit or network blip — see the perf-audit auth-dedup work this
// session, which reduces how many of those a single page load makes, but
// doesn't eliminate the possibility entirely) — and clicking the manual
// Retry button re-ran the exact same fan-of-calls immediately, often
// failing the identical way again before whatever was transient had a
// chance to clear, which read as "retry does nothing." Auto-retrying with
// a short backoff gives transient failures that chance. Bounded (not
// infinite) — after MAX_AUTO_RETRIES this still falls back to the same
// manual Retry/Home buttons as before, so a genuinely broken page settles
// into a stable, actionable state instead of retrying forever.
// Reported again (2026-09-28): still appeared intermittently right on a
// cold app open (PWA just relaunched from the home screen/lock screen).
// The original 2-retry/2.8s budget assumed a brief server-side blip, but a
// cold open can also race the device's own network radio reconnecting —
// that can take longer than 2.8s on a slow handoff. Widened the budget and
// (below) added an 'online' listener so a retry fires the instant
// connectivity actually returns, instead of only on the fixed timer.
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAYS_MS = [800, 2000, 4000];

// A distinct failure mode from the transient-network one above: the app was
// left open/backgrounded (very common for an installed PWA) across a new
// deploy, so the JS still running in the tab references chunk filenames
// (content-hashed) that the CDN no longer serves once the new deployment
// replaced them — any lazy-loaded chunk/dynamic import then 404s. `reset()`
// only re-renders the existing React tree; it can't fix this because the
// stale JS is still what's running. Only a real navigation (hard reload)
// re-fetches the current HTML/JS and resolves it. Matches both the classic
// webpack "ChunkLoadError" and the newer "Failed to fetch dynamically
// imported module" wording browsers use for ESM-style dynamic imports.
const CHUNK_LOAD_ERROR_PATTERN = /ChunkLoadError|Loading (chunk|CSS chunk)|fetch dynamically imported module/i;
// Same root cause, different symptom (reported 2026-09-28: error screen
// appeared on /profile while the PWA stayed open across several deploys in
// one evening): the old JS calls a Server Action by an ID the new
// deployment no longer has, and Next's client throws "Server Action ... was
// not found on the server". Also only fixable by a hard reload.
const STALE_SERVER_ACTION_PATTERN = /was not found on the server|Failed to find Server Action/i;
function isStaleDeploymentError(message: string): boolean {
  return CHUNK_LOAD_ERROR_PATTERN.test(message) || STALE_SERVER_ACTION_PATTERN.test(message);
}
// Guards against a reload loop if the server is genuinely down (a hard
// reload would just hit the same broken deploy and throw again forever).
// Originally "one reload per browser session" — but an installed PWA can
// live through several deploys in one session, and every deploy after the
// first then fell straight through to the manual error screen. Now a
// timestamp: at most one stale-deploy reload per cooldown window, so each
// new deploy gets its own recovery while a reload that immediately fails
// again (within the window) still settles into the retry/manual UI.
const CHUNK_RELOAD_SESSION_KEY = "wealth-os:error-boundary-chunk-reload";
const STALE_RELOAD_COOLDOWN_MS = 60_000;

function canReloadForStaleDeploy(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY));
    return !Number.isFinite(last) || Date.now() - last > STALE_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markStaleDeployReload() {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — canReloadForStaleDeploy() then returns false
    // next time, which is the safe (no-loop) direction.
  }
}

// Module-level, not component state/refs — a first implementation using a
// useRef counter was found (via a real forced-error QA test, see this
// commit) to retry forever, never settling: Next.js does not guarantee this
// boundary keeps the same component instance across every reset()-triggered
// re-attempt, so a ref/state counter tied to component identity can get
// silently reset to 0 on some of those attempts, and each fresh "0" looks
// like "haven't retried yet" — infinite loop. A module-level variable
// persists for the lifetime of the loaded page (unaffected by React mount/
// unmount), so it can't be reset that way. Keyed by the error's own
// identity so a genuinely NEW/different failure gets its own fresh retry
// budget instead of inheriting an exhausted count from an unrelated earlier
// error; only resets to 0 on a real full navigation (new page load) or when
// the SAME error recurs after already being retried the full budget.
let lastErrorKey: string | null = null;
let autoRetryCount = 0;

/**
 * Segment-level error boundary (Day 8 STEP 4). Catches any error thrown
 * while rendering a page/layout under `src/app` that doesn't have its own,
 * more specific `error.tsx`.
 *
 * Deliberately does NOT use the `useTranslation()` i18n hook or any other
 * app machinery beyond the most basic UI primitives — this boundary must
 * still render correctly even when the failure originated in a layout that
 * would normally provide that context (e.g. `(app)/layout.tsx`'s
 * `I18nProvider`, if `getProfile()` itself threw). Static bilingual text,
 * Thai-first per CLAUDE.md, is the more robust choice here.
 *
 * Never renders `error.message`/`error.stack` in production — only in dev,
 * where seeing the real error without digging through server logs is worth
 * more than strict production-parity in the one place that's guaranteed to
 * only ever appear when something has already gone wrong.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Always true on the true first render — see the module-level comment
  // above for why the actual counter lives outside the component. The
  // effect below is what keeps this in sync with that counter on every
  // subsequent retry attempt.
  const [autoRetrying, setAutoRetrying] = useState(true);

  useEffect(() => {
    const errorKey = `${error.digest ?? ""}:${error.message}`;
    if (errorKey !== lastErrorKey) {
      lastErrorKey = errorKey;
      autoRetryCount = 0;
    }

    captureError(error, {
      route: "app-error-boundary",
      extra: { digest: error.digest ?? null, autoRetryAttempt: autoRetryCount },
    });

    if (isStaleDeploymentError(error.message) && canReloadForStaleDeploy()) {
      markStaleDeployReload();
      window.location.reload();
      return;
    }

    if (autoRetryCount >= MAX_AUTO_RETRIES) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoRetrying(false);
      return;
    }

    setAutoRetrying(true);
    const delay = RETRY_DELAYS_MS[autoRetryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];

    let firedOnce = false;
    const retryNow = () => {
      if (firedOnce) return;
      firedOnce = true;
      autoRetryCount += 1;
      reset();
    };

    const timer = setTimeout(retryNow, delay);
    // On a cold app open the device's network radio may still be
    // reconnecting when the failing request fired — waiting out the rest
    // of a fixed delay wastes retry budget that connectivity itself
    // already resolved. Retry as soon as the browser reports 'online';
    // the timer above remains as a backstop for browsers that don't fire
    // this event reliably.
    window.addEventListener("online", retryNow);

    return () => {
      firedOnce = true;
      clearTimeout(timer);
      window.removeEventListener("online", retryNow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (autoRetrying) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div
          className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">กำลังลองโหลดใหม่... / Retrying...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">เกิดข้อผิดพลาดบางอย่าง</h1>
        <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
        {/* Production hides error text (see doc comment above), but an
            opaque digest is safe to show and lets a reported screenshot be
            matched to the server log entry. */}
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">รหัสข้อผิดพลาด / Error code: {error.digest}</p>
        ) : null}
      </div>
      {process.env.NODE_ENV !== "production" ? (
        <pre className="max-w-lg overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
      ) : null}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            autoRetryCount = 0;
            reset();
          }}
        >
          ลองใหม่ / Retry
        </Button>
        {/* Reported: pressing this did nothing when the same error recurred
            (e.g. after Retry exhausted its budget). Cause: <Link> is a
            client-side transition — if the destination throws the identical
            error again, the module-level autoRetryCount/lastErrorKey above
            (deliberately NOT reset by navigation, see that comment) is
            already exhausted, so the new error boundary instance settles
            immediately with no visible feedback, reading as "the button did
            nothing." A real navigation sidesteps this: `window.location`
            reloads the JS module fresh (autoRetryCount/lastErrorKey reset to
            their initial values) and re-sends everything (cookies, a fresh
            server render) — the best chance of actually recovering, not just
            of retrying with the same client state that may itself be part
            of the problem (see the chunk-load-error handling above, same
            reasoning). */}
        <Button
          variant="outline"
          onClick={() => {
            // A hard navigation is intentional here, not an oversight —
            // router.push()/<Link> are client-side transitions too, so
            // they'd hit the exact same stale-module-state bug this fix
            // addresses (see the comment above). window.location.href is
            // the one navigation method that actually reloads fresh.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/dashboard";
          }}
        >
          กลับหน้าหลัก / Home
        </Button>
      </div>
    </div>
  );
}
