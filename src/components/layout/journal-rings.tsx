/**
 * Planner binder rings (Journal v2.2, 2026-10-09 — re-matched to the owner's
 * mockup): a dark bronze ring rail runs the full length of the spine, and a
 * 6-ring planner mechanism sits on it — two groups of three slim oval rings,
 * top and bottom, with the middle of the spine left clear. Each ring is seen
 * side-on: it leaves the rail and loops into a punched hole in the page.
 * Fixed to the screen like the binder of a real planner, so they stay put
 * while the page scrolls; decoration only (aria-hidden, no touches).
 */
const RING_POSITIONS = ["8%", "19%", "30%", "68%", "79%", "90%"];

export function JournalRings() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+0.5rem)] bottom-24 left-0 z-20 w-11 md:left-56"
    >
      {/* The ring rail (the metal mechanism the rings are mounted on). */}
      <div className="journal-ring-rail absolute inset-y-0 left-[7px] w-[9px] rounded-full" />
      {RING_POSITIONS.map((top, i) => (
        <svg
          key={top}
          viewBox="0 0 44 18"
          className="absolute left-0 h-[18px] w-11 -translate-y-1/2"
          style={{ top }}
        >
          <defs>
            <linearGradient id={`journal-ring-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#b89e72" />
              <stop offset="0.35" stopColor="#7a5c38" />
              <stop offset="1" stopColor="#3a2914" />
            </linearGradient>
          </defs>
          {/* Shadow the ring casts on the page */}
          <ellipse cx="22.5" cy="10.6" rx="13" ry="5" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="3.4" />
          {/* The ring itself, seen side-on: a slim oval from the rail to the hole */}
          <ellipse cx="22" cy="9" rx="13" ry="5.4" fill="none" stroke={`url(#journal-ring-${i})`} strokeWidth="3.2" />
          {/* Highlight along the top of the wire */}
          <path d="M12 4.6 Q22 3.2 32 4.6" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" strokeLinecap="round" />
          {/* Punched hole in the page the ring disappears into */}
          <ellipse cx="35.2" cy="9" rx="2.9" ry="4" fill="#1e150c" fillOpacity="0.85" />
        </svg>
      ))}
    </div>
  );
}
