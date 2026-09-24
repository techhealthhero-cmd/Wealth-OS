import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Reported (production-hardening audit): ~24 of ~29 authenticated routes
 * had no `loading.tsx` at all — every one of them fetches its data via
 * server-side `Promise.all` with zero skeleton in between, so a visit
 * showed a blank content area (below the stable header/tab bar) until the
 * page's queries resolved. money/transactions/loading.tsx and
 * plan/goals/loading.tsx already established this same "Next.js renders
 * this automatically while page.tsx's data resolves" pattern, hand-tailored
 * to their own layout; this is a generic, reusable version for the
 * remaining routes, most of which are lists of cards. Not a perfect
 * shape-match for every route (e.g. profile/billing aren't card lists),
 * but a generic skeleton is strictly better than the blank screen every
 * one of these routes had before.
 */
export function RouteLoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
