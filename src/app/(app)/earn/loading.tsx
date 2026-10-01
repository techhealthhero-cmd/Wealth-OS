import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Nav/perf audit: same rationale as money/transactions/loading.tsx — "Earn" previously had no loading shell either. */
export default function EarnLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" aria-busy="true" aria-label="Loading Earn">
      <Skeleton className="h-32 w-full rounded-[1.75rem]" />
      <Skeleton className="h-64 w-full rounded-[2rem]" />
      <Skeleton className="h-44 w-full rounded-[1.75rem]" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="rounded-[1.75rem]">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-[1.75rem]" />
    </div>
  );
}
