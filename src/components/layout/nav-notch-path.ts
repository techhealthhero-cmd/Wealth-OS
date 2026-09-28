/**
 * Geometry for the bottom nav's "notch" bar (reference: a dark pill whose
 * top edge dips into a smooth U-shaped valley under the active tab, with
 * that tab's icon circle floating inside the valley and a visible gap ring
 * around it).
 *
 * Each notch is a circle of radius `notchRadius` centered `centerY` px
 * below the bar's top edge, cut out of the bar. The corners where that
 * circle meets the flat top edge are rounded with fillets — small circles
 * tangent to both the top edge and the notch circle — which give the
 * reference's soft "shoulders". Each shoulder is sized independently: as
 * broad as `fillet` wherever there's room (long gentle S-curve, like the
 * reference), shrinking toward `minFillet` only on a side that faces a
 * neighbouring notch (the permanent center "+" and an adjacent active tab)
 * or the end of the bar. Pure and deterministic so it can be unit-tested;
 * BottomNav only feeds it measured sizes and the (animated) notch x's.
 */
export interface NotchGeometry {
  notchRadius: number;
  centerY: number;
  /** Largest (preferred) shoulder fillet radius. */
  fillet: number;
  /** Smallest shoulder fillet allowed when space is tight. */
  minFillet: number;
}

/** Horizontal distance from a notch's center to where a shoulder of fillet `s` meets the flat top edge. */
export function shoulderReach(notchRadius: number, centerY: number, s: number): number {
  const d = notchRadius + s;
  const dy = s - centerY;
  return Math.sqrt(Math.max(d * d - dy * dy, 0));
}

/** Half the span a notch occupies on the top edge, with the given fillet on both sides (defaults to the preferred one). */
export function notchHalfWidth(g: NotchGeometry, fillet: number = g.fillet): number {
  return shoulderReach(g.notchRadius, g.centerY, fillet);
}

/** Largest fillet in [minFillet, fillet] whose shoulder reach fits within `space`, or minFillet if none does. */
function fitFillet(g: NotchGeometry, space: number): number {
  for (let s = g.fillet; s > g.minFillet; s -= 0.5) {
    if (shoulderReach(g.notchRadius, g.centerY, s) <= space) return s;
  }
  return g.minFillet;
}

/**
 * Shrinks the notch radius only if even minimum-fillet shoulders of two
 * adjacent notches `slotWidth` apart would overlap (leaving `minRidge` px
 * of flat edge between them) — i.e. very narrow phones.
 */
export function fitNotchToSlot(preferred: NotchGeometry, slotWidth: number, minRidge = 2): NotchGeometry {
  const maxHalf = (slotWidth - minRidge) / 2;
  let notchRadius = preferred.notchRadius;
  while (notchRadius > 8 && shoulderReach(notchRadius, preferred.centerY, preferred.minFillet) > maxHalf) {
    notchRadius -= 0.5;
  }
  return notchRadius === preferred.notchRadius ? preferred : { ...preferred, notchRadius };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

interface ResolvedNotch {
  cx: number;
  sL: number;
  sR: number;
}

function resolveShoulders(xs: number[], width: number, g: NotchGeometry, minRidge: number): ResolvedNotch[] {
  const notches = xs.map((cx) => ({ cx, sL: g.fillet, sR: g.fillet }));
  notches.forEach((n, i) => {
    // Space on each side: half the gap to a neighbour (split evenly), or
    // all the way to the bar's end.
    const leftSpace = i === 0 ? n.cx : (n.cx - notches[i - 1].cx - minRidge) / 2;
    const rightSpace = i === notches.length - 1 ? width - n.cx : (notches[i + 1].cx - n.cx - minRidge) / 2;
    n.sL = fitFillet(g, leftSpace);
    n.sR = fitFillet(g, rightSpace);
  });
  return notches;
}

/**
 * SVG path for the whole bar: a rounded rectangle (`width` × `height`,
 * corner radius `cornerRadius`) with one notch per entry of `notchXs`
 * (px from the left edge). Top corners shrink when a notch sits close to an
 * end, so the shoulder flows straight out of the corner instead of
 * colliding with it.
 */
export function buildNotchedBarPath(
  width: number,
  height: number,
  cornerRadius: number,
  notchXs: number[],
  g: NotchGeometry,
  minRidge = 2
): string {
  const { notchRadius: R, centerY: cy } = g;
  const notches = resolveShoulders([...notchXs].sort((a, b) => a - b), width, g, minRidge);
  const rr = Math.min(cornerRadius, height / 2, width / 2);

  const first = notches[0];
  const last = notches[notches.length - 1];
  const leftStart = first ? first.cx - shoulderReach(R, cy, first.sL) : Infinity;
  const rightEnd = last ? width - (last.cx + shoulderReach(R, cy, last.sR)) : Infinity;
  const rTL = Math.max(0, Math.min(rr, leftStart));
  const rTR = Math.max(0, Math.min(rr, rightEnd));

  const parts: string[] = [`M 0 ${r2(rTL)}`];
  if (rTL > 0) parts.push(`A ${r2(rTL)} ${r2(rTL)} 0 0 1 ${r2(rTL)} 0`);

  for (const { cx, sL, sR } of notches) {
    const leftX = cx - shoulderReach(R, cy, sL);
    const rightX = cx + shoulderReach(R, cy, sR);
    // Tangent point between a fillet circle (center (fx, s)) and the notch
    // circle (center (cx, cy)) lies on the line joining their centers, R
    // away from the notch center.
    const kL = R / (R + sL);
    const kR = R / (R + sR);
    const pL = { x: cx + (leftX - cx) * kL, y: cy + (sL - cy) * kL };
    const pR = { x: cx + (rightX - cx) * kR, y: cy + (sR - cy) * kR };
    // The hole arc runs through the bottom of the notch circle; it's the
    // large arc only when the tangent points' average sits above the center.
    const largeArc = (pL.y + pR.y) / 2 < cy ? 1 : 0;

    parts.push(`L ${r2(leftX)} 0`);
    parts.push(`A ${r2(sL)} ${r2(sL)} 0 0 1 ${r2(pL.x)} ${r2(pL.y)}`);
    parts.push(`A ${r2(R)} ${r2(R)} 0 ${largeArc} 0 ${r2(pR.x)} ${r2(pR.y)}`);
    parts.push(`A ${r2(sR)} ${r2(sR)} 0 0 1 ${r2(rightX)} 0`);
  }

  parts.push(`L ${r2(width - rTR)} 0`);
  if (rTR > 0) parts.push(`A ${r2(rTR)} ${r2(rTR)} 0 0 1 ${r2(width)} ${r2(rTR)}`);
  parts.push(`L ${r2(width)} ${r2(height - rr)}`);
  parts.push(`A ${r2(rr)} ${r2(rr)} 0 0 1 ${r2(width - rr)} ${r2(height)}`);
  parts.push(`L ${r2(rr)} ${r2(height)}`);
  parts.push(`A ${r2(rr)} ${r2(rr)} 0 0 1 0 ${r2(height - rr)}`);
  parts.push("Z");
  return parts.join(" ");
}
