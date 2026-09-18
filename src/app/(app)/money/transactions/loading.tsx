import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Nav/perf audit: tapping "Money" in the bottom nav previously showed a
 * blank content area until the transaction list resolved — this was the
 * only bottom-nav destination besides /dashboard with no loading shell.
 * Next.js renders this automatically while `page.tsx`'s data resolves; the
 * shared MoneyTabs/header above it (money/layout.tsx) stay mounted and
 * don't re-suspend, so the tab bar never disappears/jumps during the
 * transition (matches the "bottom nav must stay stable" requirement).
 */
export default function TransactionsLoading() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
