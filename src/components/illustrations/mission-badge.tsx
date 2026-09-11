interface MissionBadgeProps {
  size?: number;
  className?: string;
}

/**
 * For the future gamification/missions feature (CLAUDE.md Phase 6 — not
 * built yet): a simple ribbon badge in the existing amber chart color, not
 * a literal gold-gradient medal (against the "no gradients" rule). Not
 * imported anywhere yet.
 */
export function MissionBadge({ size = 40, className }: MissionBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M11 20L7 29L16 25L25 29L21 20" fill="var(--chart-4)" opacity="0.5" />
      <circle cx="16" cy="14" r="11" fill="var(--chart-4)" />
      <path
        d="M11 14.5L14.5 18L21.5 10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
