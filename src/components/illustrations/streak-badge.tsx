interface StreakBadgeProps {
  size?: number;
  className?: string;
}

/**
 * For the future gamification/missions feature (GRAPHICS_PLAN.md P2/P3 —
 * CLAUDE.md Phase 6, not built yet). A simple flame in the warm chart
 * accent color, alongside the existing `MissionBadge` (completed mission)
 * — same flat, single-shape restraint. Not imported anywhere yet.
 */
export function StreakBadge({ size = 32, className }: StreakBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="var(--chart-2)" opacity="0.15" />
      <path
        d="M16 6c1 3-3 4-3 8a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.5 2-1 3-2 3-1.5 0-2-1-1.5-2.5C17 11 17.5 8 16 6Z"
        fill="var(--chart-2)"
      />
    </svg>
  );
}
