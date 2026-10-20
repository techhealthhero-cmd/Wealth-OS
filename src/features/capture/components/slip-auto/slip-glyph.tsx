/** Tiny drawn slip (no real image). `tint` is a decorative bank colour. */
export function SlipGlyph({
  tint = "#2f9e5b",
  label,
  labelColor = "#1d2a24",
  className,
  ...box
}: {
  tint?: string;
  label?: string;
  labelColor?: string;
  className?: string;
  /** Position/size when nested inside another <svg>. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  return (
    <svg viewBox="0 0 60 76" className={className} aria-hidden="true" style={{ color: tint }} {...box}>
      <rect x=".5" y=".5" width="59" height="75" rx="4" fill="#fff" stroke="rgba(60,45,20,.14)" />
      <path d="M.5 4.5a4 4 0 0 1 4-4h51a4 4 0 0 1 4 4V12H.5z" fill="currentColor" />
      <circle cx="12" cy="6.5" r="2.6" fill="#fff" opacity=".9" />
      <rect x="18" y="5" width="22" height="3" rx="1.5" fill="#fff" opacity=".8" />
      <circle cx="30" cy="22" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M27.8 22l1.6 1.7 3-3.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {label ? (
        <text x="30" y="44" textAnchor="middle" fontSize={label.length > 3 ? 8.5 : 9} fontWeight="700" fill={labelColor}>
          {label}
        </text>
      ) : null}
      <rect x="14" y="52" width="32" height="2.4" rx="1.2" fill="#dde4df" />
      <rect x="8" y="59" width="44" height="2.4" rx="1.2" fill="#e6ebe7" />
      <rect x="8" y="65" width="30" height="2.4" rx="1.2" fill="#e6ebe7" />
    </svg>
  );
}
