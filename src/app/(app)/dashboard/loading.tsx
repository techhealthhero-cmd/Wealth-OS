import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * 2026-09 motion system: Next.js shows this automatically while
 * `dashboard/page.tsx`'s initial data resolves — skeleton placeholders
 * matching each section's final shape (per the "prefer skeleton loading
 * over large spinners" rule), not a single full-page spinner. Shapes
 * mirror the actual dashboard hierarchy: Net Worth hero, monthly summary
 * cards, goal card, two charts, secondary detail grid, account balances +
 * recent transactions.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:space-y-6 md:pb-8">
      <Skeleton className="h-8 w-44" />

      {/* Net Worth hero */}
      <Skeleton className="h-40 w-full rounded-xl" />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Goal progress */}
      <Skeleton className="h-28 w-full rounded-xl" />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>

      {/* Secondary detail grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      {/* Account balances + recent transactions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
