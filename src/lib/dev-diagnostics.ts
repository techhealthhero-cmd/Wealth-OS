import "server-only";

/**
 * Navigation/performance/query timing audit (2026-09) — dev-only console
 * diagnostics, no-ops in production so this never adds log noise or a
 * timing-measurement tax to a real deployment. Two small, focused tools:
 *
 * `logNav()` — call immediately before every server-side `redirect()` so an
 * "unexpected bounce" report can be traced to the exact guard that caused
 * it (which route, why, which file). `redirect()` itself throws internally
 * to unwind rendering, so this must run BEFORE calling it, never wrapped
 * around it.
 *
 * `withPerfLog()` — wraps an async data loader and logs its wall-clock
 * duration, to find real bottlenecks instead of guessing. Applied to the
 * handful of highest-traffic loaders (see call sites), not every query in
 * the app — that would be noise, not signal.
 */

const isDev = process.env.NODE_ENV === "development";

export function logNav(params: { from: string; to: string; reason: string; source: string }): void {
  if (!isDev) return;
  console.log(`[NAV] from=${params.from} to=${params.to} reason="${params.reason}" source=${params.source}`);
}

export async function withPerfLog<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isDev) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = (performance.now() - start).toFixed(0);
    console.log(`[PERF] ${label}: ${ms}ms`);
  }
}
