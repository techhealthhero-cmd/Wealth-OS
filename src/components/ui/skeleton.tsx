import { cn } from "cn"

// 2026-09 motion system: a slow, low-contrast shimmer sweep (see
// `.skeleton-shimmer` in globals.css) reads calmer than Tailwind's default
// `animate-pulse` opacity blink, and matches the ~1.2-1.6s "soft shimmer"
// spec rather than Tailwind's 2s pulse cycle.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
