import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { captureError, captureMessage } from "@/lib/observability";

/**
 * Handles both email-confirmation links and OAuth (e.g. Google) redirects.
 * Supabase appends `?code=...` to the redirect URL; exchanging it sets the
 * session cookie via the server client's cookie adapter.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validated against an open-redirect (see safe-redirect.ts) — this value
  // is attacker-controllable via a crafted link's query string.
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");
  // Supabase sometimes redirects with an error instead of a code (e.g. an
  // expired or already-used link) — surface that instead of a bare "code
  // missing" message.
  const authError = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    captureError(new Error(error.message), {
      route: "auth/callback",
      operation: "exchangeCodeForSession",
      extra: { status: error.status ?? "", code: error.code ?? "" },
    });
    const detail =
      process.env.NODE_ENV !== "production"
        ? `[dev] exchangeCodeForSession failed (${error.status ?? "?"}${error.code ? `/${error.code}` : ""}): ${error.message}`
        : "auth_callback";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(detail)}`);
  }

  captureMessage("No `code` param on callback URL", {
    route: "auth/callback",
    operation: "missing_code",
    extra: { authError: authError ?? "" },
  });
  const detail =
    process.env.NODE_ENV !== "production"
      ? `[dev] No code param on callback URL${authError ? ` — Supabase reported: ${authError}` : ""}`
      : "auth_callback";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(detail)}`);
}
