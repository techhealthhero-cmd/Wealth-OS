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
