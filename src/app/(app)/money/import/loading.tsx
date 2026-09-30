import { Skeleton } from "@/components/ui/skeleton";

export default function StatementImportLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}

