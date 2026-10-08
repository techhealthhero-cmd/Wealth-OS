import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getClientEnv } from "@/config/env";
import { logNav } from "@/lib/dev-diagnostics";
import { captureError } from "@/lib/observability";
import { isTransientAuthError } from "@/lib/supabase/auth-errors";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
];

function isPublicRoute(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/** Carry any rotated or cleared Supabase cookies onto a redirect response. */
export function redirectWithSessionCookies(url: URL, sessionResponse: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from protected routes. Called from the root
 * `src/proxy.ts`.
 *
 * IMPORTANT: this must create a response via `NextResponse.next({ request })`
 * up front and keep mutating that same response object — creating a new
 * response after cookies are set drops the refreshed session cookie.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getClientEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: revalidates the auth token and must run before any
  // route-protection logic below reads the user.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (authError && isTransientAuthError(authError)) {
    captureError(authError, {
      route: pathname,
      provider: "supabase",
      operation: "refresh_session",
      extra: {
        status: authError.status ?? 0,
        code: authError.code ?? "",
      },
    });

    // Do not turn a temporary Auth/network failure into a logout. Continue
    // with the session cookies untouched; protected rendering will either
    // succeed on its own auth check or reach the retrying error boundary.
    return supabaseResponse;
  }

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    logNav({ from: pathname, to: "/login", reason: "no session", source: "middleware.updateSession" });
    return redirectWithSessionCookies(redirectUrl, supabaseResponse);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    logNav({ from: pathname, to: "/dashboard", reason: "already signed in", source: "middleware.updateSession" });
    return redirectWithSessionCookies(
      new URL("/dashboard", request.url),
      supabaseResponse
    );
  }

  return supabaseResponse;
}
