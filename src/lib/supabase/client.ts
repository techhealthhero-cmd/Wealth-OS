import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/config/env";

/**
 * Supabase client for use in Client Components ("use client"). Safe to call
 * repeatedly — each call returns a lightweight client bound to the browser's
 * cookie jar, so there's no need to memoize it at module scope.
 *
 * Deliberately untyped (no `Database` generic): the installed `@supabase-js`
 * / `postgrest-js` prerelease has a stricter generic `Database` contract
 * than `supabase gen types` output follows, and this project has no linked
 * Supabase project to generate types from yet (see src/types/database.ts).
 * Type safety is enforced at the application boundary instead — every
 * query/action function under src/features declares an explicit return
 * type built from the hand-written domain types.
 */
export function createClient() {
  const env = getClientEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
