"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/i18n/client";
import { SwipeTabPages } from "@/components/layout/swipe-tab-pages";
import { bookNeighbour } from "@/components/layout/journal-book";
import { NotebookOpening } from "@/components/notebook/notebook-opening";
import type { CoverPreferences } from "@/lib/notebook-covers/config";
import { LaunchStillScene } from "./launch-still";

type CoverState = "open" | "closing" | "closed" | "opening";

/**
 * Home as the first page of the journal (2026-10-11, requested): swipe
 * right-to-left and the page turns over to Money (then on through the whole
 * book); swipe left-to-right and — there being no page before Home — the
 * front cover swings shut. The closed journal stays on the desk (no balance
 * left on screen) until it's tapped, then opens again with the quick opening.
 */
export function HomeBook({
  prefs,
  displayName,
  children,
}: {
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name">;
  displayName: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [cover, setCover] = useState<CoverState>("open");

  // The closed book is a full-screen moment: no scrolling the page behind it.
  useEffect(() => {
    if (cover === "open") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [cover]);

  return (
    <>
      <SwipeTabPages
        hrefs={["/dashboard"]}
        activeIndex={0}
        nextHref={bookNeighbour("/dashboard", 1)}
        onCloseBook={() => setCover("closing")}
      >
        {children}
      </SwipeTabPages>

      {cover === "closing" ? (
        <NotebookOpening prefs={prefs} variant="quick" direction="close" onDone={() => setCover("closed")} />
      ) : null}

      {cover === "closed" && typeof document !== "undefined"
        ? createPortal(
            <>
              <LaunchStillScene prefs={prefs} />
              <button
                type="button"
                onClick={() => setCover("opening")}
                aria-label={t("notebookCover.tapToOpen")}
                className="fixed inset-0 z-[201] flex flex-col items-center justify-end pb-[calc(env(safe-area-inset-bottom)+4.5rem)] text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/40"
              >
                <span className="text-base font-semibold text-[#3b2f22]">{t("notebookCover.tapToOpen")}</span>
                <span className="mt-1 text-sm text-[#5c564b]">{t("notebookCover.closedHint")}</span>
              </button>
            </>,
            document.body
          )
        : null}

      {cover === "opening" ? (
        <NotebookOpening prefs={prefs} variant="quick" displayName={displayName} onDone={() => setCover("open")} />
      ) : null}
    </>
  );
}
