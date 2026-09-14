/**
 * Validates a post-auth redirect target so it can only ever point somewhere
 * inside this app — never off-site. Found during the Day 8 security audit:
 * `auth/callback/route.ts` read `?next=` straight from the request URL and
 * interpolated it into a redirect with no validation, an open-redirect
 * pattern (OWASP A01) that lets a crafted link send an authenticated user
 * to an attacker-controlled origin immediately after a real login/email-
 * confirmation flow completes — a much more convincing phishing vector than
 * a cold link, since the victim just interacted with the real app.
 *
 * Only a single-leading-slash relative path is accepted. Rejects:
 * - absolute URLs ("https://evil.com", "javascript:...")
 * - protocol-relative URLs ("//evil.com" — resolves to a different host)
 * - backslash tricks ("/\evil.com" — some browsers normalize "\" to "/",
 *   turning this into a protocol-relative URL after the fact)
 */
export function safeRedirectPath(path: string | null | undefined, fallback: string): string {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
