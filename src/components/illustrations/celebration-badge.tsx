interface CelebrationBadgeProps {
  size?: number;
  className?: string;
}

/**
 * For a future bigger milestone moment (goal reached, net worth milestone —
 * GRAPHICS_PLAN.md P3, none of those features are built yet). Distinct from
 * the routine-save `SuccessBadge`: a star with a few short understated
 * radiating dashes — still flat, still one color, still no confetti (see
 * GRAPHICS_PLAN.md's Tone rules — "tasteful celebration only"). Not
 * imported anywhere yet.
 */
export function CelebrationBadge({ size = 40, className }: CelebrationBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1="16"
          y1="2"
          x2="16"
          y2="5.5"
          stroke="var(--chart-4)"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${angle} 16 16)`}
        />
      ))}
      <circle cx="16" cy="16" r="9" fill="var(--chart-4)" />
      <path
        d="M16 11.5L17.4 14.6L20.8 15L18.3 17.2L19 20.5L16 18.8L13 20.5L13.7 17.2L11.2 15L14.6 14.6L16 11.5Z"
        fill="white"
      />
    </svg>
  );
}
