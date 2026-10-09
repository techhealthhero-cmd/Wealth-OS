"use client";

import { useState } from "react";

import { NotebookCoverFace } from "@/components/notebook/notebook-cover";
import { getCoverTheme, type CoverPreferences } from "@/lib/notebook-covers/config";
import { isLaunchHandled } from "@/lib/notebook-covers/launch-state";

/**
 * The closed journal on the desk, shown while the app shell is still being
 * prepared on the server (the (app) layout's Suspense fallback). It is part
 * of the very first bytes of the response, so a launch paints the user's
 * own cover almost immediately instead of a blank white screen; when the
 * shell arrives, the launch opening takes over from this exact pose (same
 * size, position and angle as the first keyframe) and opens the cover.
 *
 * Static (no motion of its own). Renders nothing once the journal has been
 * opened this session — e.g. arriving from the onboarding opening — or when
 * the server decided there is no launch opening (`show` false).
 */
export function LaunchStill({
  prefs,
  show,
}: {
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name">;
  show: boolean;
}) {
  // Server render and hydration agree (the guard is false until an effect
  // somewhere marks the launch handled).
  const [visible] = useState(() => show && !isLaunchHandled());
  if (!visible) return null;
  return <LaunchStillScene prefs={prefs} />;
}

/**
 * The still itself. The iOS launch images in public/splash are screenshots
 * of this exact scene (default cover) at each iPhone size, so the OS launch
 * screen and this first paint line up — re-capture them if the pose, desk
 * or default cover changes.
 */
export function LaunchStillScene({ prefs }: { prefs: Pick<CoverPreferences, "theme" | "decorations" | "name"> }) {
  const theme = getCoverTheme(prefs.theme);
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-background"
    >
      <div className="notebook-desk absolute inset-0" />
      <div className="relative w-[min(64vw,18rem)]">
        <div
          className="relative aspect-[210/292]"
          style={{ perspective: "1600px", transform: "translateX(0) rotateY(8deg) scale(0.98)" }}
        >
          <div
            className="absolute inset-0 rounded-[6px_10px_10px_6px] shadow-[0_18px_30px_-12px_rgba(30,18,6,0.55)]"
            style={{ background: theme.shade, transform: "translate(5px, 4px)" }}
          />
          <div className="absolute inset-0">
            <NotebookCoverFace theme={prefs.theme} decorations={prefs.decorations} name={prefs.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
