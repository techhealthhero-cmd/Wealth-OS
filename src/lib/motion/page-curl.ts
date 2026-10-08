/**
 * Page curl geometry for the Journal page turn (2026-10-09).
 *
 * A real sheet of paper doesn't tilt as a rigid board — you grab a CORNER,
 * the paper folds along a slanted line, and the part past that line flips
 * over showing its back. This is the classic fold model (the one book-flip
 * libraries use):
 *
 *   C = the corner being pulled (where it rests when the page is flat)
 *   P = where that corner is now (under the finger)
 *   fold line = the perpendicular bisector of C→P
 *
 * Everything on C's side of the fold is the lifted flap; it is drawn
 * reflected across the fold (so corner C lands on P), and the page beneath
 * shows through where it lifted. Moving P changes the angle of the fold, so
 * a pull is naturally uneven — exactly like paper.
 *
 * Rendering uses only transforms: a huge overflow-hidden "wrap" box rotated
 * so one edge lies on the fold clips each half, and its content is
 * counter-transformed back into place. No clip-path, nothing repainted per
 * frame — the compositor moves it.
 *
 * Pure math lives here (unit-tested in tests/page-curl.test.ts); the DOM
 * wiring lives in swipe-tab-pages.tsx.
 */

export interface Point {
  x: number;
  y: number;
}

/** Fold line through M with direction u; n is the unit normal pointing toward the corner C (the lifted side). */
export interface FoldFrame {
  m: Point;
  u: Point;
  n: Point;
}

/** CSS `matrix(a, b, c, d, e, f)`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type Matrix = [number, number, number, number, number, number];

const fmt = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(4)));
export const cssMatrix = (m: Matrix) => `matrix(${m.map(fmt).join(", ")})`;

/**
 * The fold for corner C pulled to P. Returns null when P is (almost) on C —
 * the page is flat, there is no fold.
 */
export function foldFrame(c: Point, p: Point): FoldFrame | null {
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;
  const n = { x: dx / len, y: dy / len };
  // u = n rotated -90°, so (u, n) is a proper rotation (determinant +1).
  const u = { x: n.y, y: -n.x };
  return { m: { x: (c.x + p.x) / 2, y: (c.y + p.y) / 2 }, u, n };
}

/** Local fold coordinates (s along the fold, t toward the corner) → page coordinates. */
export function frameMatrix(f: FoldFrame): Matrix {
  return [f.u.x, f.u.y, f.n.x, f.n.y, f.m.x, f.m.y];
}

/** Page coordinates → local fold coordinates (the inverse rotation). */
export function inverseFrameMatrix(f: FoldFrame): Matrix {
  return [f.u.x, f.n.x, f.u.y, f.n.y, -(f.u.x * f.m.x + f.u.y * f.m.y), -(f.n.x * f.m.x + f.n.y * f.m.y)];
}

/** Apply a CSS-style matrix to a point (used by tests and for sanity checks). */
export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Signed distance of a point from the fold: > 0 on the corner's (lifted) side. */
export function sideOfFold(f: FoldFrame, p: Point): number {
  return (p.x - f.m.x) * f.n.x + (p.y - f.m.y) * f.n.y;
}

/** Reflect a point across the fold line — where a point of the lifted flap ends up. */
export function reflectAcrossFold(f: FoldFrame, p: Point): Point {
  const d = sideOfFold(f, p);
  return { x: p.x - 2 * d * f.n.x, y: p.y - 2 * d * f.n.y };
}

export interface CurlTransforms {
  /** Wrap that keeps the flat (not-lifted) side of the page: local t ∈ [-L, 0]. */
  frontWrap: string;
  /** Cancels frontWrap so the page content stays where it was. */
  frontInner: string;
  /** Wrap for the folded-over flap, which lies on the flat side too: t ∈ [-L, 0]. */
  flapWrap: string;
  /** The page's back, reflected across the fold, so only the lifted part shows. */
  flapInner: string;
  /** Shadow strip cast onto the page underneath, on the lifted side: t ∈ [0, castDepth]. */
  cast: string;
  /** How far the corner has been pulled, 0 (flat) … 1+ (folded past the spine). */
  amount: number;
}

/**
 * Transforms for every layer, given the corner C, its pulled position P,
 * and L — a length larger than the page diagonal (wrap boxes are 2L × L).
 * When the page is flat (P on C) the fold is parked off the corner, so the
 * whole page shows and the flap is empty.
 */
export function curlTransforms(c: Point, p: Point, l: number, pageWidth: number): CurlTransforms {
  const frame = foldFrame(c, p) ?? foldFrame(c, { x: c.x - 0.5, y: c.y })!;
  const fm = cssMatrix(frameMatrix(frame));
  const finv = cssMatrix(inverseFrameMatrix(frame));
  const wrap = `${fm} translate(${-l}px, ${-l}px)`;
  const inner = `translate(${l}px, ${l}px)`;
  return {
    frontWrap: wrap,
    frontInner: `${inner} ${finv}`,
    flapWrap: wrap,
    flapInner: `${inner} scale(1, -1) ${finv}`,
    cast: `${fm} translate(${-l}px, 0px)`,
    amount: Math.min(Math.hypot(c.x - p.x, c.y - p.y) / Math.max(pageWidth, 1), 2),
  };
}

/**
 * Where the corner is while a finger drags: it follows the finger
 * sideways, and lifts toward the page's middle as it's pulled (a real
 * corner rises as you peel it), so the fold slants instead of staying
 * vertical.
 */
export function dragCornerPosition(c: Point, dx: number, dy: number, width: number, height: number): Point {
  const pulled = Math.min(Math.max(-dx, 0), width * 1.6);
  const lift = Math.min(pulled * 0.22, height * 0.22);
  const towardMiddle = c.y > height / 2 ? -1 : 1;
  return { x: c.x - pulled, y: c.y + towardMiddle * lift + dy * 0.35 };
}

/** Where a fully turned corner ends: past the spine, so the whole page has flipped off the left edge. */
export function turnedCornerPosition(c: Point, width: number, height: number): Point {
  const towardMiddle = c.y > height / 2 ? -1 : 1;
  // Far enough left, with only a little lift, that the fold clears the
  // spine along the page's whole height (a steeper fold left a sliver of
  // the top-left corner flat — caught by tests/page-curl.test.ts).
  return { x: -width * 1.3, y: c.y + towardMiddle * height * 0.04 };
}

/**
 * Corner position along a turn, from `from` to `to` at eased progress `p`,
 * on a gentle arc (the corner rises a little mid-turn) rather than a
 * straight line.
 */
export function cornerAlongTurn(from: Point, to: Point, p: number, height: number, cornerAtBottom: boolean): Point {
  const arc = Math.sin(Math.PI * p) * height * 0.06 * (cornerAtBottom ? -1 : 1);
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p + arc };
}

/** Ease-out cubic — fast while the finger's momentum carries the page, settling gently. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
/** Ease-in-out for a page landing from the other side. */
export const easeInOutCubic = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
