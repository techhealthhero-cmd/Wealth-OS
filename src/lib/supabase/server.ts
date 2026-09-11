import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getClientEnv } from "@/config/env";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. Reads/writes auth cookies via `next/headers`.
 *
 * In a Server Component, `cookies().set()` is a no-op (Next.js forbids
 * mutating cookies during render) — that's fine because the middleware
 * (`src/lib/supabase/middleware.ts`) is responsible for refreshing the
 * session cookie on every request. This client only needs to *read* cookies
 * during render; Route Handlers and Server Actions can both read and write.
 *
 * Deliberately untyped (no `Database` generic) — see the comment in
 * `lib/supabase/client.ts` for why.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getClientEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component during render — safe to ignore
            // because the middleware refreshes the session cookie instead.
          }
        },
      },
    }
  );
}
