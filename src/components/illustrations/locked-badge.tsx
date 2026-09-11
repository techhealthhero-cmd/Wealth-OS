interface LockedBadgeProps {
  size?: number;
  className?: string;
}

/**
 * For a future locked/premium feature state (GRAPHICS_PLAN.md P1 status
 * system — Success/Info/Warning/Error/Loading are already covered by the
 * toast icon set in `components/ui/sonner.tsx`; this was the one missing
 * piece). A plain lock, not a "premium" gem/crown — no billing system
 * exists yet, so this stays a neutral status mark rather than a marketing
 * visual. Not imported anywhere yet.
 */
export function LockedBadge({ size = 32, className }: LockedBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="var(--muted-foreground)" opacity="0.15" />
      <rect x="10" y="15" width="12" height="10" rx="2.5" fill="var(--muted-foreground)" />
      <path
        d="M12.5 15V11.5a3.5 3.5 0 0 1 7 0V15"
        stroke="var(--muted-foreground)"
        strokeWidth="2.2"
        fill="none"
      />
      <circle cx="16" cy="19.5" r="1.6" fill="var(--popover)" />
    </svg>
  );
}
