import { Skeleton } from "@/components/ui/skeleton";

export default function InvoiceLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-lg space-y-4 pb-36">
      <Skeleton className="h-10 w-2/3 rounded-xl" />
      <Skeleton className="h-48 rounded-[20px]" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24 rounded-[18px] border" />
      ))}
    </div>
  );
}
