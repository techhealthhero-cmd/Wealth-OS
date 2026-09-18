import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Nav/perf audit: same rationale as money/transactions/loading.tsx — "AI" previously had no loading shell either. */
export default function AICoachLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Card>
        <CardContent className="space-y-2 pt-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}
