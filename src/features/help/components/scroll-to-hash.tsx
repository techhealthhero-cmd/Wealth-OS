"use client";

import { useEffect } from "react";

/**
 * A client-side navigation to `/help#section` (e.g. Home's "Why yearly?")
 * arrives before the streamed page has the target, so the browser's own
 * hash jump never fires and the page sits at the top. Scroll once the
 * section is mounted.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
