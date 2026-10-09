"use client";

import { useEffect, useRef, useState } from "react";

import { NotebookOpening } from "@/components/notebook/notebook-opening";
import type { CoverPreferences } from "@/lib/notebook-covers/config";
import type { OpeningVariant } from "@/lib/notebook-covers/playback";
import { isLaunchHandled } from "@/lib/notebook-covers/launch-state";
import { markFirstOpeningPlayed } from "@/features/notebook-cover/actions";
import { writeLaunchCookieClient } from "@/lib/notebook-covers/launch-cookie";

/**
 * Plays the journal opening once per fresh app launch (a new document load)
 * in the user's chosen style. Mounted by the persistent (app) layout, which
 * resolves `variant` on the server from the saved mode — so the overlay is
 * in the very first HTML and starts on first paint, with no flash of the
 * dashboard first and no client-side preference fetch.
 *
 * It never replays on route changes (the layout stays mounted), on
 * remounts / RSC refreshes (state + the module-level launch guard), or when
 * the app returns from the background without a reload. The page underneath
 * renders and loads its data in parallel — nothing waits for the animation.
 */
export function NotebookLaunch({
  variant,
  prefs,
  displayName,
  firstPlayed,
  isFirstTimeOpening,
}: {
  variant: OpeningVariant | null;
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name" | "openingMode">;
  displayName: string | null;
  /** The account has already seen the full opening (database truth). */
  firstPlayed: boolean;
  /** Mode "first_time" and not yet seen: record it once it has played. */
  isFirstTimeOpening: boolean;
}) {
  // Server render and hydration both start "showing" (the guard is false
  // until an effect runs); a client-side remount after the launch already
  // happened starts hidden.
  const [show, setShow] = useState(() => variant !== null && !isLaunchHandled());
  const markedRef = useRef(false);

  useEffect(() => {
    const markNow = show && isFirstTimeOpening && !markedRef.current;
    if (markNow) {
      markedRef.current = true;
      // Fire-and-forget: if it fails, the worst case is one more full
      // opening on the next launch.
      markFirstOpeningPlayed().catch(() => {});
    }
    // Re-sync the launch cookie with the database on every launch, so the
    // closed journal painted before the next launch's data arrives is the
    // right one (e.g. after changing the cover on another device).
    writeLaunchCookieClient({
      prefs: { theme: prefs.theme, decorations: prefs.decorations, name: prefs.name, openingMode: prefs.openingMode },
      firstPlayed: firstPlayed || markedRef.current,
    });
  }, [show, isFirstTimeOpening, firstPlayed, prefs.theme, prefs.decorations, prefs.name, prefs.openingMode]);

  if (!show || variant === null) return null;
  return (
    <NotebookOpening
      launch
      variant={variant}
      prefs={prefs}
      displayName={displayName}
      onDone={() => setShow(false)}
    />
  );
}
