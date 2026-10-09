"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { getCoverTheme, type CoverPreferences } from "@/lib/notebook-covers/config";
import { OPENING_TIMINGS } from "@/lib/notebook-covers/playback";
import { NotebookCoverFace } from "./notebook-cover";
import { coverSerif } from "./cover-font";

type Stage = "enter" | "closed" | "opening" | "reveal" | "exit";

const ORDER: Stage[] = ["enter", "closed", "opening", "reveal", "exit"];
const atLeast = (stage: Stage, min: Stage) => ORDER.indexOf(stage) >= ORDER.indexOf(min);

const PAPER = "#f6efdf";
const INK = "#3b2f22";
const noopSubscribe = () => () => {};

const OPEN_EASE = "cubic-bezier(0.55, 0.06, 0.22, 1)";

/**
 * The notebook-opening moment: closed journal → the front cover swings open
 * around its spine in 3D → the first page greets the user → hand-off.
 *
 * Pure CSS transforms/opacity on a handful of layers (GPU-composited; no
 * animation library, no WebGL). Stages run on timers from OPENING_TIMINGS;
 * the whole thing is ~1.65 s in "full" mode and a ~0.45 s fade in
 * "reduced" mode (prefers-reduced-motion). It never blocks the app: Skip is
 * visible and focused from the first frame, Escape skips too, and if the
 * app is backgrounded mid-animation it simply finishes (no half-open book
 * waiting on return). Every timer/listener is cleared on unmount.
 *
 * `exit`:
 *  - "fade": the overlay fades away, revealing the page underneath
 *    (settings preview / replay).
 *  - "hold": the book fades out onto the app's own background colour and
 *    the overlay stays until the caller navigates away (onboarding → the
 *    dashboard), so there is no flash of the onboarding page in between.
 */
export function NotebookOpening({
  prefs,
  mode,
  displayName,
  exit = "fade",
  onDone,
}: {
  prefs: CoverPreferences;
  mode: "full" | "reduced";
  displayName?: string | null;
  exit?: "fade" | "hold";
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const timings = OPENING_TIMINGS[mode];
  const [stage, setStage] = useState<Stage>(mode === "full" ? "enter" : "reveal");
  const doneRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const onDoneRef = useRef(onDone);
  const skipRef = useRef<HTMLButtonElement>(null);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    onDoneRef.current();
  }, []);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const schedule: [Stage | "done", number][] = [];
    let at = 0;
    if (mode === "full") {
      // One frame in "enter" so the closed book can transition in.
      schedule.push(["closed", 30]);
      at = 30 + timings.closed;
      schedule.push(["opening", at]);
      at += timings.open;
      schedule.push(["reveal", at]);
    }
    at += timings.reveal;
    schedule.push(["exit", at]);
    at += timings.exit;
    schedule.push(["done", at]);

    timersRef.current = schedule.map(([next, ms]) =>
      window.setTimeout(() => (next === "done" ? finish() : setStage(next)), ms)
    );

    const onVisibility = () => {
      if (document.visibilityState === "hidden") finish();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, mode, timings]);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
  }, [isClient]);

  // Portals need document.body: render nothing on the server and during
  // hydration (no mismatch), then the overlay on the client.
  if (!isClient) return null;

  const theme = getCoverTheme(prefs.theme);
  const exiting = stage === "exit";
  const fadeOverlay = exit === "fade" && exiting;

  // The book itself stays flat and gives its children their own perspective;
  // only the cover is a 3D context. (With preserve-3d on the book too, Chrome
  // stopped painting the cover once it swung past ~110°.)
  const bookStyle: CSSProperties = {
    perspective: "1600px",
    transform:
      stage === "enter"
        ? "translateX(0) rotateY(10deg) scale(0.92)"
        : stage === "closed"
          ? "translateX(0) rotateY(10deg) scale(1)"
          : stage === "opening"
            ? "translateX(9%) rotateY(0deg) scale(1)"
            : "translateX(9%) rotateY(0deg) scale(1.04)",
    opacity: stage === "enter" || (exit === "hold" && exiting) ? 0 : 1,
    transition: `transform ${stage === "opening" ? timings.open : timings.closed}ms ${OPEN_EASE}, opacity ${exiting ? timings.exit : timings.closed}ms ease`,
  };

  const coverStyle: CSSProperties = {
    transformOrigin: "left center",
    transformStyle: "preserve-3d",
    transform: atLeast(stage, "opening") ? "rotateY(-172deg)" : "rotateY(0deg)",
    // No opacity here, ever: opacity < 1 forces transform-style: flat, which
    // breaks backface-visibility and shows the front face mirrored.
    transition: `transform ${timings.open}ms ${OPEN_EASE}`,
    display: mode === "reduced" ? "none" : undefined,
  };

  const reveal = (delay: number): CSSProperties => ({
    opacity: atLeast(stage, "reveal") ? 1 : 0,
    transform: atLeast(stage, "reveal") ? "translateY(0)" : "translateY(6px)",
    transition: `opacity ${timings.reveal}ms ease ${delay}ms, transform ${timings.reveal}ms ease ${delay}ms`,
  });

  const welcome = displayName
    ? t("notebookCover.openingWelcomeNamed").replace("{name}", displayName)
    : t("notebookCover.openingWelcome");

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("notebookCover.openingLabel")}
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-background"
      style={{ opacity: fadeOverlay ? 0 : 1, transition: `opacity ${timings.exit}ms ease` }}
    >
      {/* Warm desk backdrop; fades to the app background on a "hold" exit. */}
      <div
        aria-hidden="true"
        className="notebook-desk absolute inset-0"
        style={{ opacity: exit === "hold" && exiting ? 0 : 1, transition: `opacity ${timings.exit}ms ease` }}
      />

      <button
        ref={skipRef}
        type="button"
        onClick={finish}
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-4 z-10 rounded-full bg-black/35 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {t("notebookCover.skip")}
      </button>

      <div className="relative w-[min(64vw,18rem)]" style={{ perspective: "1800px" }}>
        <div className="relative aspect-[210/292]" style={bookStyle}>
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
            <div className="flex h-full flex-col px-[11%] pt-[14%] pb-[10%]">
              <p className={`${coverSerif.className} text-[clamp(1.6rem,8vw,2.2rem)] leading-none italic`} style={reveal(0)}>
                {t("notebookCover.openingHello")}
              </p>
              <p className="mt-2 text-[clamp(0.8rem,3.6vw,0.95rem)] leading-snug font-medium" style={reveal(40)}>
                {welcome}
              </p>
              <svg viewBox="0 0 40 40" className="mx-auto my-[9%] w-[26%]" aria-hidden="true" style={reveal(80)}>
                <path d="M20 36 V18" stroke="#5f7d52" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 26 C 15 25 9 21 8 13 C 15 13 19 18 20 26 Z" fill="#7c9a6c" />
                <path d="M20 20 C 22 13 28 9 34 8 C 34 15 28 20 20 20 Z" fill="#5f7d52" />
              </svg>
              <ul className="space-y-1.5 text-[clamp(0.72rem,3.2vw,0.85rem)]">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-2" style={reveal(110 + i * 40)}>
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
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent"
              style={{
                opacity: atLeast(stage, "opening") ? 0 : 1,
                transition: `opacity ${timings.open}ms ${OPEN_EASE}`,
                display: mode === "reduced" ? "none" : undefined,
              }}
            />
            {/* Gutter shading along the binding */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-gradient-to-r from-[rgba(80,55,25,0.18)] to-transparent" />
          </div>

          {/* Front cover: front face + inside face (endpaper) */}
          <div className="absolute inset-0" style={coverStyle}>
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
    </div>,
    document.body
  );
}
