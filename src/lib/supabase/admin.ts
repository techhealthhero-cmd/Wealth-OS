import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getServerEnv, requireServiceRoleKey } from "@/config/env";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * The `server-only` import above makes any accidental import from a Client
 * Component fail the build, but that alone doesn't stop misuse from *server*
 * code — only reach for this client for genuinely privileged operations
 * (e.g. the profile-bootstrap trigger's fallback path, admin scripts,
 * background jobs). Ordinary request handling should use
 * `lib/supabase/server.ts`, which enforces RLS using the caller's identity.
 *
 * Deliberately untyped (no `Database` generic) — see the comment in
 * `lib/supabase/client.ts` for why.
 */
export function createAdminClient() {
  const env = getServerEnv();
  const serviceRoleKey = requireServiceRoleKey();

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
