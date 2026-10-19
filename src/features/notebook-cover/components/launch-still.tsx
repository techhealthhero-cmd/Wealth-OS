"use client";

import { useState, type CSSProperties, type Ref } from "react";

import { NotebookCoverFace } from "@/components/notebook/notebook-cover";
import { getCoverTheme, type CoverPreferences } from "@/lib/notebook-covers/config";
import { isLaunchHandled } from "@/lib/notebook-covers/launch-state";
import { CLOSED_BOOK_POSE } from "../cover-swipe";

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
export function LaunchStillScene({ prefs, coverFaceRef }: {
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name">;
  coverFaceRef?: Ref<HTMLDivElement>;
}) {
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
          style={{ perspective: coverFaceRef ? "1200px" : "1600px", transform: CLOSED_BOOK_POSE }}
        >
          <div
            className="absolute inset-0 rounded-[6px_10px_10px_6px] shadow-[0_18px_30px_-12px_rgba(30,18,6,0.55)]"
            style={{ background: theme.shade, transform: "translate(5px, 4px)" }}
          />
          {coverFaceRef ? (
            <>
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[4px_9px_9px_4px]" style={{ background: theme.paper, transform: "translate(3px, 2px)" }} />
              <div data-cover-page aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[4px_9px_9px_4px]"
                style={{ backgroundColor: "#fffbf2", backgroundImage: "linear-gradient(to right, transparent 12%, rgba(167,83,89,0.16) 12%, rgba(167,83,89,0.16) calc(12% + 1px), transparent calc(12% + 1px)), repeating-linear-gradient(to bottom, transparent 0, transparent 14px, rgba(38,51,45,0.055) 14px, rgba(38,51,45,0.055) 15px)" }}>
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5" style={{ background: "linear-gradient(to right, rgba(80,55,25,0.18), transparent)" }} />
                <div data-cover-shade="page" aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to right, rgba(30,18,6,0.75), rgba(30,18,6,0.25) 45%, transparent)", opacity: "var(--cover-page, 0)" }} />
              </div>
              <div ref={coverFaceRef} data-cover-wrapper className="absolute inset-0" style={{ transformOrigin: "left center", transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d" }}>
                <div data-cover-front className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", visibility: "var(--cover-front-visibility, visible)" as CSSProperties["visibility"] }}>
                  <NotebookCoverFace theme={prefs.theme} decorations={prefs.decorations} name={prefs.name} />
                  <div data-cover-shade="front" aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[6px_10px_10px_6px]" style={{ background: "linear-gradient(to right, transparent, #160f08)", opacity: "var(--cover-front, 0)" }} />
                </div>
                <div data-cover-back className="absolute inset-0 rounded-[9px_4px_4px_9px] p-[5%]" style={{ background: theme.shade, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", visibility: "var(--cover-back-visibility, hidden)" as CSSProperties["visibility"] }}>
                  <div className="h-full w-full rounded-[4px]" style={{ background: theme.paper }} />
                  <div data-cover-shade="back" aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[9px_4px_4px_9px]" style={{ background: "linear-gradient(to right, rgba(255,251,242,0.25), #160f08)", opacity: "var(--cover-back, 0.32)" }} />
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0">
              <NotebookCoverFace theme={prefs.theme} decorations={prefs.decorations} name={prefs.name} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
