import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Nav/perf audit: same rationale as money/transactions/loading.tsx — "Plan" previously had no loading shell either. */
export default function GoalsLoading() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
