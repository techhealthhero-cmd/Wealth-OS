import type { IllustrationProps } from "./types";

/** Empty state for "no transactions yet": a receipt/list outline — communicates "a record will appear here," not "nothing exists." */
export function EmptyTransactionsIllustration({ size = 160, className }: IllustrationProps) {
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
        d="M62 44H138V152L128 145L118 152L108 145L98 152L88 145L78 152L68 145L62 152V44Z"
        fill="white"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M76 68H124" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M76 84H124" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M76 100H108" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />

      <circle cx="146" cy="120" r="22" fill="var(--chart-3)" />
      <path
        d="M137 120L144 127L157 112"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
