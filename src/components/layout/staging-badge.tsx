import { getAppEnv, getClientEnv } from "@/config/env";

/**
 * Visible-everywhere indicator for a non-production deployment (staging-
 * isolation audit, item 10: "a clear staging/test mode ... visible small
 * indicator"). Renders nothing at all in production — this component's
 * entire body is skipped, not just hidden with CSS, so there's no risk of
 * a style regression ever exposing it to real users.
 *
 * Found via real staging testing and corrected: an earlier version of this
 * badge asserted "SHARED PRODUCTION DATABASE" whenever the dedicated
 * `NEXT_PUBLIC_STAGING_SUPABASE_*` vars weren't set — but that's a false
 * alarm for a deployment that isolates its database the OTHER valid way,
 * Vercel's own per-environment scoping of the SAME `NEXT_PUBLIC_SUPABASE_*`
 * name (a different value for Preview than for Production). This
 * component has no way to tell those two cases apart without hardcoding
 * the production project's URL for comparison, which this codebase's own
 * rules forbid — so it no longer claims to know which one is true. It
 * only asserts confidence when `isUsingStagingSupabase` is true (the
 * dedicated vars ARE active, so a separate project is certain); otherwise
 * it's a neutral reminder, not an alarm.
 */
export function StagingBadge() {
  const appEnv = getAppEnv();
  if (appEnv === "production") return null;

  const { isUsingStagingSupabase } = getClientEnv();

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 py-1 text-center text-xs font-semibold text-black">
      {isUsingStagingSupabase
        ? `${appEnv.toUpperCase()} · TEST MODE (isolated Supabase staging project)`
        : `${appEnv.toUpperCase()} · TEST MODE — verify NEXT_PUBLIC_SUPABASE_URL is scoped to a separate project for this environment in Vercel`}
    </div>
  );
}
