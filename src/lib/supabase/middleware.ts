import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getClientEnv } from "@/config/env";
import { logNav } from "@/lib/dev-diagnostics";

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

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from protected routes. Called from the root
 * `middleware.ts`.
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
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    logNav({ from: pathname, to: "/login", reason: "no session", source: "middleware.updateSession" });
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    logNav({ from: pathname, to: "/dashboard", reason: "already signed in", source: "middleware.updateSession" });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
