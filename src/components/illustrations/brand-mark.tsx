interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * WEALTH OS logomark: a wallet with a coin/clasp accent. Kept deliberately
 * simple (one shape + one line + one dot) so it stays legible at the small
 * sizes it actually ships at (header, sidebar, favicon-scale contexts) —
 * every extra detail is a detail that disappears below ~24px. Single-color
 * via currentColor so it inherits `text-primary` wherever it's placed and
 * follows light/dark automatically.
 */
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="7" width="26" height="20" rx="6" fill="currentColor" opacity="0.12" />
      <rect x="3" y="7" width="26" height="20" rx="6" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3 14H22a2.5 2.5 0 0 1 2.5 2.5v0A2.5 2.5 0 0 1 22 19H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="22" cy="16.5" r="1.75" fill="currentColor" />
    </svg>
  );
}
