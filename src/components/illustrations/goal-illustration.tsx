import type { IllustrationProps } from "./types";

/**
 * A flag reached via a dashed path — "a target you're moving toward," not a
 * generic trophy. Used on the Goals empty state.
 *
 * A small dot travels the same path toward the flag on a slow, gentle loop
 * (`.motion-goal-dot` in globals.css) — an abstract "always moving toward
 * the goal" cue. Deliberately NOT a character/person walking: the user
 * asked for exactly that ("a kid chasing their dream, walking toward the
 * flag"), but GRAPHICS_PLAN.md explicitly rules out "detailed character art
 * or realistic human figures" and "a mascot-first product" — a literal
 * walking figure would read as childish, which the brand is deliberately
 * avoiding even for the AI Coach illustration. This keeps the same
 * emotional intent (progress toward a dream) within that constraint.
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

      <circle r="5" fill="var(--primary)" className="motion-goal-dot" />

      <line x1="140" y1="50" x2="140" y2="150" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M140 52L168 64L140 76Z" fill="var(--chart-5)" />
      <ellipse cx="140" cy="152" rx="16" ry="5" fill="var(--primary)" opacity="0.15" />
    </svg>
  );
}
