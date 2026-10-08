import { describe, expect, it } from "vitest";

import {
  applyMatrix,
  cornerAlongTurn,
  curlTransforms,
  dragCornerPosition,
  foldFrame,
  frameMatrix,
  inverseFrameMatrix,
  reflectAcrossFold,
  sideOfFold,
  turnedCornerPosition,
} from "@/lib/motion/page-curl";

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe("page curl fold geometry", () => {
  const corner = { x: 390, y: 700 };
  const pulled = { x: 250, y: 640 };

  it("has no fold while the corner rests on the page", () => {
    expect(foldFrame(corner, corner)).toBeNull();
  });

  it("folds along the perpendicular bisector: the corner reflects exactly onto the finger", () => {
    const f = foldFrame(corner, pulled)!;
    close(reflectAcrossFold(f, corner), pulled);
    // The midpoint is on the fold, and the corner is on the lifted side.
    expect(sideOfFold(f, f.m)).toBeCloseTo(0, 9);
    expect(sideOfFold(f, corner)).toBeGreaterThan(0);
    expect(sideOfFold(f, { x: 0, y: 0 })).toBeLessThan(0); // the spine stays flat
  });

  it("frame and inverse frame are proper rotations that undo each other", () => {
    const f = foldFrame(corner, pulled)!;
    const m = frameMatrix(f);
    expect(m[0] * m[3] - m[2] * m[1]).toBeCloseTo(1, 9); // determinant +1: no mirroring
    for (const p of [{ x: 0, y: 0 }, { x: 123, y: 456 }, corner]) {
      close(applyMatrix(m, applyMatrix(inverseFrameMatrix(f), p)), p);
    }
  });

  it("a drag lifts the corner toward the middle, so the fold slants (uneven pull)", () => {
    const p = dragCornerPosition(corner, -120, 0, 390, 760);
    expect(p.x).toBe(270);
    expect(p.y).toBeLessThan(corner.y); // bottom corner rises
    const f = foldFrame(corner, p)!;
    expect(Math.abs(f.u.x)).toBeGreaterThan(0.01); // not a vertical fold
    const top = dragCornerPosition({ x: 390, y: 0 }, -120, 0, 390, 760);
    expect(top.y).toBeGreaterThan(0); // top corner drops toward the middle
  });

  it("a fully turned corner has folded the whole page past the spine", () => {
    const end = turnedCornerPosition(corner, 390, 760);
    const f = foldFrame(corner, end)!;
    // Every corner of the page is on the lifted side → nothing flat remains.
    for (const p of [{ x: 0, y: 0 }, { x: 390, y: 0 }, { x: 0, y: 760 }, { x: 390, y: 760 }]) {
      expect(sideOfFold(f, p)).toBeGreaterThan(0);
    }
  });

  it("the turn path starts and ends where it should", () => {
    const end = turnedCornerPosition(corner, 390, 760);
    close(cornerAlongTurn(pulled, end, 0, 760, true), pulled);
    close(cornerAlongTurn(pulled, end, 1, 760, true), end);
  });

  it("builds transforms for a flat page without dividing by zero", () => {
    const t = curlTransforms(corner, corner, 2000, 390);
    expect(t.amount).toBe(0);
    expect(t.frontWrap).toContain("matrix(");
    expect(t.flapInner).toContain("scale(1, -1)");
    expect(`${t.frontWrap}${t.flapWrap}${t.cast}`).not.toContain("NaN");
  });
});
