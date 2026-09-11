import type { IllustrationProps } from "./types";

/**
 * For the future Budget / Safe-to-Spend feature (GRAPHICS_PLAN.md P2 —
 * CLAUDE.md's Smart Budget / Safe-to-Spend systems, not built yet). A
 * half-gauge/meter motif — "how much room is left" — rather than a literal
 * piggy bank. Not imported anywhere yet.
 */
export function BudgetIllustration({ size = 160, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M40 130A60 60 0 0 1 160 130"
        stroke="var(--muted)"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 130A60 60 0 0 1 122 76"
        stroke="var(--chart-3)"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="100" cy="130" r="6" fill="var(--primary)" />
      <line x1="100" y1="130" x2="128" y2="98" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" />

      <rect x="70" y="150" width="60" height="14" rx="7" fill="var(--primary)" opacity="0.12" />
    </svg>
  );
}
