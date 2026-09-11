import type { IllustrationProps } from "./types";

/**
 * Onboarding / landing hero: a growing stack of coins with an upward trend
 * line — "your money, growing" — rather than a literal wallet (already the
 * brand mark) or a generic handshake/rocket cliché. Three colors max, drawn
 * from the shared chart palette (`var(--chart-1/3/4)`), flat fills only.
 */
export function WelcomeIllustration({ size = 200, className }: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Trend line rising toward the coin stack */}
      <path
        d="M34 138L70 110L96 126L150 66"
        stroke="var(--chart-3)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M128 66H150V88"
        stroke="var(--chart-3)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Coin stack */}
      <ellipse cx="86" cy="150" rx="34" ry="10" fill="var(--chart-4)" opacity="0.25" />
      <rect x="60" y="132" width="52" height="18" rx="9" fill="var(--chart-4)" />
      <rect x="64" y="118" width="52" height="18" rx="9" fill="var(--chart-4)" opacity="0.85" />
      <rect x="68" y="104" width="52" height="18" rx="9" fill="var(--primary)" />
      <circle cx="94" cy="113" r="5" fill="white" opacity="0.35" />

      {/* Floating accent dots */}
      <circle cx="150" cy="140" r="6" fill="var(--chart-5)" />
      <circle cx="44" cy="70" r="4" fill="var(--chart-3)" />
    </svg>
  );
}
