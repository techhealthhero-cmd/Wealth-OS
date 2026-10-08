interface AuthErrorLike {
  name?: unknown;
  status?: unknown;
  code?: unknown;
}

const TERMINAL_SESSION_CODES = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
]);

const TRANSIENT_AUTH_CODES = new Set([
  "request_timeout",
  "over_request_rate_limit",
]);

/**
 * `getUser()` returns `user: null` both when there really is no session and
 * when Supabase Auth is temporarily unreachable. Treating both cases as a
 * signed-out user makes a short network/service interruption look like a
 * logout and sends the user to `/login` even though their refresh cookie is
 * still valid.
 *
 * Only definite missing/expired/revoked-session responses are terminal.
 * Network failures, throttling and server failures should keep the cookie in
 * place and be retried by the app's normal error recovery instead.
 */
export function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const authError = error as AuthErrorLike;
  const name = typeof authError.name === "string" ? authError.name : "";
  const code = typeof authError.code === "string" ? authError.code : "";
  const status = typeof authError.status === "number" ? authError.status : undefined;

  if (name === "AuthSessionMissingError" || TERMINAL_SESSION_CODES.has(code)) {
    return false;
  }

  if (
    name === "AuthRetryableFetchError" ||
    name === "AuthUnknownError" ||
    name === "AuthRefreshDiscardedError" ||
    TRANSIENT_AUTH_CODES.has(code)
  ) {
    return true;
  }

  if (status === 0 || status === 408 || status === 425 || status === 429) {
    return true;
  }

  if (status !== undefined) return status >= 500;

  // An unclassified failure without an HTTP response is normally a fetch,
  // DNS, abort, or runtime failure. Preserve the session rather than forcing
  // a logout on an error we cannot prove is an authentication rejection.
  return true;
}
