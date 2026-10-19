import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Small "coming soon" tag for features that are not built yet. */
export function SoonChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-dashed border-[#cdb787] bg-[#fdf3c4]/70 px-2 py-px text-[10.5px] leading-4 font-medium whitespace-nowrap text-[#86703f] dark:border-[#9c8155]/60 dark:bg-[#3a331f] dark:text-[#e2cfa6]",
        className
      )}
    >
      {children}
    </span>
  );
}
