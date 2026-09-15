interface SuccessBadgeProps {
  size?: number;
  className?: string;
}

/** A tasteful, non-celebratory success mark — a filled check circle, no confetti/sparkle. Used as the transaction-save toast icon and available for future confirmation moments (e.g. a completed goal). */
export function SuccessBadge({ size = 20, className }: SuccessBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="var(--chart-3)" />
      <path
        className="success-checkmark-path"
        d="M10 16.5L14 20.5L22 11.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
