import type { IllustrationProps } from "./types";

/**
 * For the future "Earn" feature (CLAUDE.md Phase 5 — not built yet): an
 * ascending bar sequence with an upward arrow — income growing, matching
 * the product's stated differentiator ("help users increase income, not
 * only reduce spending"). Not imported anywhere yet.
 */
export function EarnIllustration({ size = 160, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="100" cy="100" r="88" fill="var(--primary)" opacity="0.06" />

      <rect x="50" y="118" width="24" height="34" rx="6" fill="var(--primary)" opacity="0.55" />
      <rect x="84" y="98" width="24" height="54" rx="6" fill="var(--primary)" opacity="0.8" />
      <rect x="118" y="72" width="24" height="80" rx="6" fill="var(--primary)" />

      <path
        d="M56 78L84 58L104 70L146 40"
        stroke="var(--chart-3)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M126 40H146V60"
        stroke="var(--chart-3)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
