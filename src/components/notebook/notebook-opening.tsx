"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { getCoverTheme, type CoverPreferences } from "@/lib/notebook-covers/config";
import { totalOpeningDuration, type OpeningVariant } from "@/lib/notebook-covers/playback";
import { markLaunchHandled } from "@/lib/notebook-covers/launch-state";
import { NotebookCoverFace } from "./notebook-cover";
import { coverSerif } from "./cover-font";

const PAPER = "#f6efdf";
const INK = "#3b2f22";
const noopSubscribe = () => () => {};

/**
 * The notebook-opening moment: the user's closed journal → the front cover
 * swings open around its spine in 3D → (full only) the first page greets
 * them → the app.
 *
 * All motion is CSS keyframes (`.nb-open` in globals.css): GPU-composited
 * transforms/opacity on a handful of layers, no animation library. Because
 * the keyframes run on their own, a launch opening that is part of the
 * server HTML starts on first paint and always finishes (its last frame is
 * invisible and non-interactive) even before — or without — hydration.
 * JS only removes the layer at the end, and handles Skip, Escape and the
 * app being backgrounded (finish at once, no half-open book on return).
 * Every timer/listener is cleared on unmount.
 *
 * `exit`: "fade" fades the whole overlay away, revealing the page beneath
 * (launch, previews). "hold" fades the book onto the app background and
 * keeps the overlay until the caller navigates (onboarding → dashboard), so
 * nothing flashes in between.
 *
 * `launch`: rendered inline as part of the layout (server-rendered, no
 * portal), never moves focus, and is hidden entirely under
 * prefers-reduced-motion.
 */
export function NotebookOpening({
  prefs,
  variant,
  displayName,
  exit = "fade",
  launch = false,
  direction = "open",
  onDone,
}: {
  prefs: Pick<CoverPreferences, "theme" | "decorations" | "name">;
  variant: OpeningVariant;
  displayName?: string | null;
  exit?: "fade" | "hold";
  launch?: boolean;
  /**
   * "close": the same keyframes played backwards (2026-10-11, swipe back on
   * Home): the desk fades in over the app, the cover swings shut and the
   * book settles into the closed pose LaunchStillScene shows.
   */
  direction?: "open" | "close";
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const skipRef = useRef<HTMLButtonElement>(null);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }, []);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Any opening counts as "the journal has been opened this session".
    markLaunchHandled();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finish, reduced ? 0 : totalOpeningDuration(variant));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") finish();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, variant]);

  const showSkip = variant === "full" && direction === "open";

  useEffect(() => {
    if (!launch && showSkip) skipRef.current?.focus({ preventScroll: true });
  }, [launch, showSkip, isClient]);

  const theme = getCoverTheme(prefs.theme);
  const welcome = displayName
    ? t("notebookCover.openingWelcomeNamed").replace("{name}", displayName)
    : t("notebookCover.openingWelcome");

  const overlay = (
    <div
      role={showSkip ? "dialog" : undefined}
      aria-modal={showSkip ? true : undefined}
      aria-label={showSkip ? t("notebookCover.openingLabel") : undefined}
      aria-hidden={showSkip ? undefined : true}
      data-variant={variant}
      data-exit={exit}
      data-launch={launch ? "true" : undefined}
      data-direction={direction === "close" ? "close" : undefined}
      className={cn(
        "nb-open fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-background",
        // The quick opening never blocks a tap, even for its ~1 s.
        !showSkip && "pointer-events-none"
      )}
    >
      <div aria-hidden="true" className="nb-desk notebook-desk absolute inset-0" />

      {showSkip ? (
        <button
          ref={skipRef}
          type="button"
          onClick={finish}
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 z-10 rounded-full bg-black/35 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {t("notebookCover.skip")}
        </button>
      ) : null}

      <div className="nb-stage relative w-[min(64vw,18rem)]">
        <div className="nb-book relative aspect-[210/292]" style={{ perspective: "1600px" }}>
          {/* Paper block edges + first page */}
          <div
            className="absolute inset-0 rounded-[6px_10px_10px_6px] shadow-[0_18px_30px_-12px_rgba(30,18,6,0.55)]"
            style={{ background: theme.shade, transform: "translate(5px, 4px)" }}
          />
          <div
            className="absolute inset-0 overflow-hidden rounded-[4px_9px_9px_4px]"
            style={{
              backgroundColor: PAPER,
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(59,47,34,0.13) 1px, transparent 1.3px)",
              backgroundSize: "12px 12px",
              color: INK,
            }}
          >
            <div className="nb-reveal flex h-full flex-col px-[11%] pt-[14%] pb-[10%]">
              <p className={`${coverSerif.className} text-[clamp(1.6rem,8vw,2.2rem)] leading-none italic`}>
                {t("notebookCover.openingHello")}
              </p>
              <p className="mt-2 text-[clamp(0.8rem,3.6vw,0.95rem)] leading-snug font-medium">{welcome}</p>
              <svg viewBox="0 0 40 40" className="mx-auto my-[9%] w-[26%]" aria-hidden="true">
                <path d="M20 36 V18" stroke="#5f7d52" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 26 C 15 25 9 21 8 13 C 15 13 19 18 20 26 Z" fill="#7c9a6c" />
                <path d="M20 20 C 22 13 28 9 34 8 C 34 15 28 20 20 20 Z" fill="#5f7d52" />
              </svg>
              <ul className="space-y-1.5 text-[clamp(0.72rem,3.2vw,0.85rem)]">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-[#5f7d52] text-[#5f7d52]">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {t(`notebookCover.openingPoints.${i}`)}
                  </li>
                ))}
              </ul>
            </div>
            {/* Shadow the cover casts on the page; lifts as it opens. */}
            <div
              aria-hidden="true"
              className="nb-shade pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
            />
            {/* Gutter shading along the binding */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-[rgba(80,55,25,0.18)] to-transparent" />
          </div>

          {/* Front cover: front face + inside face (endpaper). */}
          <div className="nb-cover absolute inset-0" style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}>
            <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
              <NotebookCoverFace theme={prefs.theme} decorations={prefs.decorations} name={prefs.name} />
            </div>
            <div
              className="absolute inset-0 rounded-[9px_4px_4px_9px] p-[5%]"
              style={{
                background: theme.shade,
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div className="h-full w-full rounded-[4px]" style={{ background: theme.paper, opacity: 0.92 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // A launch opening is part of the server HTML (so it starts on first
  // paint); others are portalled to <body> after a user action.
  if (launch) return overlay;
  if (!isClient) return null;
  return createPortal(overlay, document.body);
}
