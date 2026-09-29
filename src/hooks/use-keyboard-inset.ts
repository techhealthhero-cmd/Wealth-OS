"use client";

import { useEffect, useState } from "react";

/**
 * Height (px) of the on-screen keyboard currently covering the bottom of the
 * layout viewport, or 0 when none is open.
 *
 * iOS Safari / home-screen PWAs don't resize the layout viewport when the
 * keyboard opens — it simply overlays the page, so a `position: fixed;
 * bottom: 0` sheet ends up hidden behind it. `visualViewport` does shrink,
 * so the gap between it and `window.innerHeight` is the keyboard's height.
 * Browsers that do resize the layout viewport (most Android) report ~0 here,
 * so applying this as a bottom offset is a no-op for them.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!enabled || !vv) return;

    function update() {
      if (!vv) return;
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore sub-pixel noise and toolbar jitter; only a real keyboard counts.
      setInset(covered > 40 ? Math.round(covered) : 0);
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return enabled ? inset : 0;
}
