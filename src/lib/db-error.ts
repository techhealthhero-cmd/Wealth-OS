import { captureError } from "@/lib/observability";

/**
 * Never surface raw Postgres/PostgREST error internals to the user in
 * production. Always logs the real error server-side; in development also
 * returns it to the caller so it's visible in the UI without digging through
 * logs. Mirrors the pattern already used for auth errors in
 * src/features/auth/actions.ts.
 */
export function friendlyDbError(
  error: { message: string; code?: string },
  context: string,
  fallbackMessage: string
): string {
  captureError(new Error(error.message), { route: context, operation: "db_query", extra: { code: error.code ?? "" } });

  if (process.env.NODE_ENV !== "production") {
    return `[dev] ${context} failed (${error.code ?? "?"}): ${error.message}`;
  }

  return fallbackMessage;
}

/**
 * Same logging as friendlyDbError(), for the read-path (Server Component
 * query loaders under `features/*\/queries.ts`) which throws instead of
 * returning an ActionResult — a thrown error is what the nearest
 * `error.tsx` boundary renders. Every one of these previously did a bare
 * `throw new Error("Failed to load X")`, discarding the real Postgres/
 * PostgREST error (message/code) entirely — meaning an intermittent
 * failure left zero trace of what actually went wrong. This logs it
 * server-side first, exactly like the write-path already does.
 */
export function throwDbError(error: { message: string; code?: string }, context: string, fallbackMessage: string): never {
  captureError(new Error(error.message), { route: context, operation: "db_query", extra: { code: error.code ?? "" } });

  if (process.env.NODE_ENV !== "production") {
    throw new Error(`[dev] ${context} failed (${error.code ?? "?"}): ${error.message}`);
  }

  throw new Error(fallbackMessage);
}
