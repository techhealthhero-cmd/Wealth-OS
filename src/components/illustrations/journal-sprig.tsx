/**
 * A small pressed leaf sprig for the Journal pages (2026-10-09) — the
 * mockup's leaf decoration, drawn as flat sage shapes with ink veins.
 * Purely decorative (aria-hidden); a few per screen at most.
 */
export function JournalSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d="M10 56 C24 44 36 30 50 10" fill="none" stroke="var(--journal-leaf)" strokeWidth="1.8" strokeLinecap="round" />
      {[
        { x: 18, y: 47, r: -60 },
        { x: 27, y: 37, r: 20 },
        { x: 33, y: 30, r: -55 },
        { x: 41, y: 21, r: 25 },
        { x: 47, y: 14, r: -45 },
      ].map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
          <path
            d="M0 0 C4 -6 12 -7 17 -1 C12 4 4 5 0 0 Z"
            fill="var(--journal-leaf)"
            fillOpacity={0.8 + (i % 2) * 0.2}
          />
          <path d="M1 0 L15 -1" stroke="var(--journal-leather)" strokeOpacity="0.35" strokeWidth="0.7" />
        </g>
      ))}
    </svg>
  );
}
