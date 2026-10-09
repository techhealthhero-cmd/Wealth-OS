import type { CoverDecorationId } from "@/lib/notebook-covers/config";

/**
 * Die-cut stickers for the notebook cover (and the picker buttons). Each is
 * drawn in a 56×56 box: a cream sticker with a white die-cut border and a
 * soft lift shadow, with a small hand-inked illustration on it. Muted
 * stationery colours only — elegant on every cover, never cartoon-bright.
 */
const INK = "#5b4632";
const LEAF = "#7c9a6c";
const LEAF_DEEP = "#5f7d52";
const CLAY = "#c98b6b";
const SKY = "#a9c1cc";

function Illustration({ id }: { id: CoverDecorationId }) {
  switch (id) {
    case "leaf":
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 40 C 25 31, 30 24, 37 15" fill="none" stroke={INK} strokeWidth="1.4" />
          <path d="M26 31 C 19 30, 16 25, 17 20 C 23 21, 27 25, 26 31 Z" fill={LEAF} stroke={INK} strokeWidth="1" />
          <path d="M30 25 C 32 19, 36 17, 40 17 C 39 22, 35 26, 30 25 Z" fill={LEAF_DEEP} stroke={INK} strokeWidth="1" />
          <path d="M33 20 C 30 15, 31 11, 34 9 C 37 12, 36 17, 33 20 Z" fill={LEAF} stroke={INK} strokeWidth="1" />
          <path d="M23 36 C 27 37, 32 35, 34 31 C 30 30, 25 32, 23 36 Z" fill={LEAF_DEEP} stroke={INK} strokeWidth="1" />
        </g>
      );
    case "mountain":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <circle cx="36" cy="18" r="4.2" fill="#e8c27a" stroke={INK} strokeWidth="1" />
          <path d="M12 39 L 24 21 L 31 30 L 35 25 L 45 39 Z" fill={SKY} stroke={INK} strokeWidth="1.2" />
          <path d="M20.5 26 L 24 21 L 27.5 26 L 25.5 25 L 24 27 L 22.5 25 Z" fill="#fbf6ea" stroke={INK} strokeWidth="0.8" />
          <path d="M12 39 H 45" stroke={INK} strokeWidth="1.2" />
          <path d="M16 39 C 20 35, 24 35, 28 39" fill={LEAF} stroke={INK} strokeWidth="1" />
        </g>
      );
    case "cat":
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 41 C 15 33, 16 27, 19 24 L 18 14 L 24.5 19.5 C 26.5 19, 29.5 19, 31.5 19.5 L 38 14 L 37 24 C 40 27, 41 33, 38 41 Z" fill="#f7efe2" stroke={INK} strokeWidth="1.3" />
          <path d="M19.6 16.5 L 23 19.6 L 20 21.5 Z" fill={CLAY} opacity="0.55" />
          <path d="M36.4 16.5 L 33 19.6 L 36 21.5 Z" fill={CLAY} opacity="0.55" />
          <path d="M23 27.5 q 1.6 -1.6 3.2 0" fill="none" stroke={INK} strokeWidth="1.2" />
          <path d="M29.8 27.5 q 1.6 -1.6 3.2 0" fill="none" stroke={INK} strokeWidth="1.2" />
          <path d="M27 30.5 h 2 l -1 1.1 Z" fill={CLAY} stroke={CLAY} strokeWidth="0.6" />
          <path d="M28 31.6 q -1.2 1.6 -2.6 0.8 M28 31.6 q 1.2 1.6 2.6 0.8" fill="none" stroke={INK} strokeWidth="0.9" />
          <circle cx="22.4" cy="31" r="1.6" fill={CLAY} opacity="0.35" />
          <circle cx="33.6" cy="31" r="1.6" fill={CLAY} opacity="0.35" />
          <path d="M15 30 l 5 0.8 M15 33 l 5 -0.4 M41 30 l -5 0.8 M41 33 l -5 -0.4" stroke={INK} strokeWidth="0.7" opacity="0.7" />
        </g>
      );
    case "coffee":
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 13 c -2 3, 2 4, 0 7 M29 11 c -2 3, 2 4, 0 7" fill="none" stroke={INK} strokeWidth="1" opacity="0.7" />
          <path d="M14 23 H 38 L 36 37 C 35.5 40, 33.5 41.5, 31 41.5 H 21 C 18.5 41.5, 16.5 40, 16 37 Z" fill="#f7efe2" stroke={INK} strokeWidth="1.3" />
          <path d="M37.6 26 C 43.5 25, 44 33, 36.4 33.4" fill="none" stroke={INK} strokeWidth="1.3" />
          <path d="M15 27.5 H 37.3" stroke={CLAY} strokeWidth="2.6" opacity="0.7" />
          <path d="M11 43.5 H 41" stroke={INK} strokeWidth="1.3" />
        </g>
      );
    case "camera":
      return (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect x="11" y="19" width="34" height="22" rx="3.5" fill="#f7efe2" stroke={INK} strokeWidth="1.3" />
          <path d="M20 19 L 22.5 14.5 H 30.5 L 33 19" fill="#f7efe2" stroke={INK} strokeWidth="1.3" />
          <path d="M11 24.5 H 45" stroke={CLAY} strokeWidth="2.4" opacity="0.65" />
          <circle cx="28" cy="30.5" r="7.2" fill={SKY} stroke={INK} strokeWidth="1.3" />
          <circle cx="28" cy="30.5" r="3.6" fill="#7f97a3" stroke={INK} strokeWidth="0.9" />
          <circle cx="26.6" cy="29.1" r="1" fill="#fff" opacity="0.85" />
          <rect x="37" y="21" width="4.5" height="2.2" rx="0.6" fill={INK} opacity="0.8" />
        </g>
      );
  }
}

export function CoverDecoration({ id, size = 56 }: { id: CoverDecorationId; size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <CoverDecorationShape id={id} />
    </svg>
  );
}

/** The sticker as a bare <g> in a 56×56 box, for embedding in a larger SVG. */
export function CoverDecorationShape({ id }: { id: CoverDecorationId }) {
  return (
    <g>
      {/* Lift shadow */}
      <circle cx="28.6" cy="29.6" r="24.5" fill="#000" opacity="0.22" />
      {/* White die-cut border, then the cream sticker */}
      <circle cx="28" cy="28" r="24.5" fill="#fffdf8" />
      <circle cx="28" cy="28" r="21.5" fill="#f4ead6" />
      <Illustration id={id} />
    </g>
  );
}
