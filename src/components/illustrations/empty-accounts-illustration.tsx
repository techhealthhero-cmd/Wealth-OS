import type { IllustrationProps } from "./types";

/** Empty state for "no accounts yet": a card outline with an inviting "+" — never a sad/empty-box cliché. */
export function EmptyAccountsIllustration({ size = 160, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="42" y="70" width="116" height="76" rx="14" fill="var(--primary)" opacity="0.12" />
      <rect
        x="42"
        y="70"
        width="116"
        height="76"
        rx="14"
        stroke="var(--primary)"
        strokeWidth="4"
      />
      <rect x="42" y="92" width="116" height="16" fill="var(--primary)" opacity="0.25" />
      <circle cx="132" cy="128" r="10" fill="var(--chart-4)" />

      <circle cx="100" cy="46" r="18" fill="var(--chart-3)" />
      <path
        d="M100 38V54M92 46H108"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
