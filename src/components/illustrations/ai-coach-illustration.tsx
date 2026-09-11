import type { IllustrationProps } from "./types";

/**
 * For the future "AI Money Coach" feature (CLAUDE.md Phase 4 — not built
 * yet). A speech bubble with a small spark — "a helpful suggestion," not a
 * literal robot/mascot (avoided deliberately — see GRAPHICS_PLAN.md "what
 * WEALTH OS is not"). Not imported anywhere yet.
 */
export function AICoachIllustration({ size = 160, className }: IllustrationProps) {
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
        d="M46 60a14 14 0 0 1 14-14h80a14 14 0 0 1 14 14v54a14 14 0 0 1-14 14H92l-22 20v-20H60a14 14 0 0 1-14-14V60Z"
        fill="var(--primary)"
      />
      <circle cx="82" cy="87" r="6" fill="white" />
      <circle cx="106" cy="87" r="6" fill="white" />
      <circle cx="130" cy="87" r="6" fill="white" />

      <path
        d="M150 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"
        fill="var(--chart-5)"
      />
    </svg>
  );
}
