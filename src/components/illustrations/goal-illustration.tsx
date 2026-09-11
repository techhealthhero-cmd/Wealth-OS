import type { IllustrationProps } from "./types";

/**
 * For the future "Plan → Goals" feature (CLAUDE.md Phase 3 — not built yet).
 * A flag reached via a dashed path — "a target you're moving toward," not a
 * generic trophy. Ready to use once a Goals page exists; not imported
 * anywhere yet, so it costs nothing to ship early.
 */
export function GoalIllustration({ size = 160, className }: IllustrationProps) {
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

      <path
        d="M40 150C60 150 55 130 75 130C95 130 90 110 110 108"
        stroke="var(--chart-4)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="1 10"
        fill="none"
      />

      <line x1="140" y1="50" x2="140" y2="150" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M140 52L168 64L140 76Z" fill="var(--chart-5)" />
      <ellipse cx="140" cy="152" rx="16" ry="5" fill="var(--primary)" opacity="0.15" />
    </svg>
  );
}
