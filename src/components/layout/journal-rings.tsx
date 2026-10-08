/**
 * Planner binder rings (Journal v2.1, 2026-10-09 — matched to the owner's
 * mockup): not a dense row, but a 6-ring planner — two groups of three big
 * bronze rings, top and bottom, with the middle of the spine left clear.
 * Each ring comes out of the leather cover and enters a punched hole in the
 * page. Fixed to the screen like the binder of a real planner, so they stay
 * put while the page scrolls; decoration only (aria-hidden, no touches).
 */
const RING_POSITIONS = ["8%", "19%", "30%", "68%", "79%", "90%"];

export function JournalRings() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.5rem)] bottom-24 left-0 z-20 w-11 md:left-56"
    >
      {RING_POSITIONS.map((top, i) => (
        <svg
          key={top}
          viewBox="0 0 36 26"
          className="absolute -left-0.5 h-8 w-11 -translate-y-1/2"
          style={{ top }}
        >
          <defs>
            <linearGradient id={`journal-ring-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e9d7ae" />
              <stop offset="0.4" stopColor="#a5875a" />
              <stop offset="1" stopColor="#4a3920" />
            </linearGradient>
          </defs>
          {/* Punched hole in the page */}
          <ellipse cx="27" cy="13" rx="3.4" ry="3.1" fill="#2e2316" fillOpacity="0.55" />
          {/* Ring shadow on the cover/page */}
          <path d="M27 6.5 H12 A6.5 6.5 0 0 0 12 19.5 H27" fill="none" stroke="#000" strokeOpacity="0.28" strokeWidth="4.6" transform="translate(0.8 1.6)" />
          {/* The metal ring itself — a C that disappears into the hole */}
          <path d="M27 6.5 H12 A6.5 6.5 0 0 0 12 19.5 H27" fill="none" stroke={`url(#journal-ring-${i})`} strokeWidth="4" strokeLinecap="round" />
          {/* Highlight along the top of the ring */}
          <path d="M25 5.6 H12.5 A6 6 0 0 0 7 9" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}
