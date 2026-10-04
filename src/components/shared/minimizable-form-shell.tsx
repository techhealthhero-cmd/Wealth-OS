"use client";

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Minus, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { useMinimizableForm } from "./minimizable-form-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BLACK_HOLE_MS, blackHoleInto, gulp, prefersReducedMotion } from "@/lib/motion/black-hole";

// How far down a drag must go before releasing counts as "minimize" —
// same threshold pull-to-refresh.tsx uses, for a consistent feel.
const DISMISS_THRESHOLD_PX = 70;
// Below this, a touchmove is still ambiguous (could be a tap, a scroll
// starting inside the handle's hit area) — same dead-zone reasoning as
// pull-to-refresh.tsx: don't call preventDefault()/start visually
// dragging until there's real, deliberate downward movement.
const DRAG_START_THRESHOLD_PX = 6;
// Close animation: the sheet slides down off-screen (like dragging it away),
// then onClose() unmounts it. Requested slower (2026-10-03) so the slide is
// visible: 280ms with a front-loaded ease-out looked like it vanished, so
// it's now an even ease-in-out — the whole descent is visible. Doubled again
// on request (550ms → 1100ms) so the fold-down reads clearly.
const CLOSE_MS = 1100;
const CLOSE_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";

interface MinimizableFormShellProps {
  /** ReactNode, not just a string — some forms' headers are more than plain text (e.g. TransactionForm's type badge above the title). */
  title: ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** "dialog" (centered, matches ui/dialog.tsx) or "sheet" (bottom sheet with a drag handle, matches ui/sheet.tsx's side="bottom") — whichever the form used before adopting this shell. Defaults to "dialog". */
  variant?: "dialog" | "sheet";
  /** Imperative handle — e.g. a form that wants to close INTO something it just saved to (Black Hole). */
  handleRef?: Ref<MinimizableFormShellHandle>;
}

export interface MinimizableFormShellHandle {
  /**
   * Closes the form with the Black Hole motion into the element matching
   * `selector` (e.g. the goal's progress bar it just added money to), which
   * then gulps. Falls back to an instant close when the target isn't on
   * screen or the user prefers reduced motion.
   */
  closeInto: (selector: string) => void;
}

function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * A custom modal shell — deliberately NOT built on the shadcn `Dialog`/
 * `Sheet` primitives (see minimizable-form-context.tsx's doc comment for
 * why: Base UI's Dialog unmounts its content on close, which would lose
 * whatever the user had typed). Visually matches `Dialog`/`Sheet` (same
 * classes, copied from src/components/ui/dialog.tsx and sheet.tsx) so a
 * form adopting this shell looks identical to before.
 *
 * Escape and the header's "−" MINIMIZE (keep the draft). Requested
 * 2026-10-03: tapping the backdrop outside the card now CLOSES, like the
 * header's "X" — both slide the sheet down smoothly before unmounting.
 *
 * Known, deliberate simplification: basic aria-modal/labelledby semantics,
 * not a full keyboard focus trap — reasonable for this first pass of new,
 * carefully-scoped infrastructure rather than a wholesale a11y rewrite.
 */
export function MinimizableFormShell({
  title,
  onClose,
  children,
  className,
  variant = "dialog",
  handleRef,
}: MinimizableFormShellProps) {
  const { minimize, beginMinimize, minimized } = useMinimizableForm();
  const backdropRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  // Where the resume pill was, so a restore can grow back out of it.
  const pillPointRef = useRef<{ x: number; y: number } | null>(null);
  const wasMinimizedRef = useRef(minimized);
  const { t } = useTranslation();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  function closeAnimated() {
    if (closing) return;
    const sheet = sheetRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!sheet || reducedMotion) {
      onClose();
      return;
    }
    setClosing(true);
    sheet.style.transition = `transform ${CLOSE_MS}ms ${CLOSE_EASE}, opacity ${CLOSE_MS}ms ease-out`;
    if (variant === "sheet") {
      sheet.style.transform = "translateY(100%)";
    } else {
      // Centering lives in the separate `translate` property (Tailwind v4's
      // -translate-*), so `transform` only adds the drop. It used to repeat
      // the -50%/-50% here too, which doubled the offset and made the
      // dialog jump up-left as it closed.
      sheet.style.transform = "translateY(48px)";
      sheet.style.opacity = "0";
    }
    window.setTimeout(onClose, CLOSE_MS);
  }

  function fadeBackdrop() {
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: BLACK_HOLE_MS,
      easing: "ease-in",
      fill: "forwards",
    });
  }

  // "−" / Escape (requested 2026-10-04): the form is pulled into the resume
  // pill with the Black Hole motion instead of just vanishing, so it's clear
  // where the draft went. The pill is shown (above the form) first, then
  // the form is hidden once it has been swallowed.
  async function minimizeAnimated() {
    const sheet = sheetRef.current;
    if (!sheet || prefersReducedMotion()) {
      minimize();
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    beginMinimize();
    await nextFrame();
    await nextFrame();
    const pill = document.querySelector("[data-minimized-pill]");
    if (!pill) {
      busyRef.current = false;
      minimize();
      return;
    }
    const r = pill.getBoundingClientRect();
    pillPointRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    fadeBackdrop();
    await blackHoleInto(sheet, pill);
    busyRef.current = false;
    minimize();
  }

  async function closeInto(selector: string) {
    const sheet = sheetRef.current;
    const target = document.querySelector(selector);
    if (!sheet || !target || !isOnScreen(target) || prefersReducedMotion()) {
      onClose();
      return;
    }
    if (busyRef.current || closing) return;
    busyRef.current = true;
    fadeBackdrop();
    await blackHoleInto(sheet, target);
    onClose();
    gulp(target, 1.06);
  }

  useImperativeHandle(handleRef, () => ({ closeInto }));

  useEffect(() => {
    if (minimized) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [minimized]);

  useEffect(() => {
    if (minimized) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") void minimizeAnimated();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized, minimize]);

  // Restore: grow back OUT of the pill (Companion grow), instead of the
  // generic slide-in — the pill is where the draft visibly went.
  useLayoutEffect(() => {
    const wasMinimized = wasMinimizedRef.current;
    wasMinimizedRef.current = minimized;
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (minimized) {
      // Now hidden (display:none): drop the finished Black Hole animations
      // so the form is whole again the next time it's shown.
      sheet.getAnimations().forEach((a) => a.cancel());
      backdropRef.current?.getAnimations().forEach((a) => a.cancel());
      return;
    }
    const from = pillPointRef.current;
    if (!wasMinimized || !from || prefersReducedMotion()) return;
    // Replace the CSS slide-in (it would restart on display) with a grow
    // from the pill; it only ever plays on mount otherwise.
    sheet.style.animation = "none";
    const rect = sheet.getBoundingClientRect();
    sheet.style.transformOrigin = `${from.x - rect.left}px ${from.y - rect.top}px`;
    sheet.animate(
      [
        { transform: "scale(0.04)", opacity: 0 },
        { opacity: 1, offset: 0.35 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 560, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    );
  }, [minimized]);

  // The sheet stays mounted while minimized (an ancestor toggles
  // display:none, this component never unmounts — see
  // minimizable-form-context.tsx) — clear any leftover drag transform so
  // a drag that ended in minimize() doesn't leave the sheet visually
  // offset the next time it's restored.
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.style.transform = "";
  }, [minimized]);

  // Swipe-down-to-minimize (sheet variant only) — reported: users expect
  // to be able to pull the sheet down to dismiss it, the same gesture a
  // native bottom sheet supports; today only the header's explicit
  // minus/X buttons worked. Scoped to the drag handle + header row, not
  // the whole sheet — the content below is independently scrollable, and
  // capturing drags there would fight normal scrolling (same reasoning
  // pull-to-refresh.tsx documents for gating its own gesture on scroll
  // position).
  useEffect(() => {
    if (variant !== "sheet" || minimized) return;
    const handle = dragHandleRef.current;
    const sheet = sheetRef.current;
    if (!handle || !sheet) return;

    let startY: number | null = null;
    let dragging = false;
    let currentDelta = 0;

    function handleTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      dragging = false;
    }

    function handleTouchMove(e: TouchEvent) {
      if (startY === null || !sheet) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        dragging = false;
        currentDelta = 0;
        sheet.style.transform = "";
        return;
      }
      if (!dragging && delta < DRAG_START_THRESHOLD_PX) return;
      dragging = true;
      currentDelta = delta;
      e.preventDefault();
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${delta}px)`;
    }

    function handleTouchEnd() {
      if (sheet) {
        sheet.style.transition = "";
        if (!(dragging && currentDelta >= DISMISS_THRESHOLD_PX)) sheet.style.transform = "";
      }
      if (dragging && currentDelta >= DISMISS_THRESHOLD_PX) minimize();
      startY = null;
      dragging = false;
      currentDelta = 0;
    }

    handle.addEventListener("touchstart", handleTouchStart, { passive: true });
    handle.addEventListener("touchmove", handleTouchMove, { passive: false });
    handle.addEventListener("touchend", handleTouchEnd, { passive: true });
    handle.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      handle.removeEventListener("touchstart", handleTouchStart);
      handle.removeEventListener("touchmove", handleTouchMove);
      handle.removeEventListener("touchend", handleTouchEnd);
      handle.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [variant, minimized, minimize]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        ref={backdropRef}
        onClick={closeAnimated}
        className={cn(
          "fixed inset-0 isolate z-50 bg-black/10 transition-opacity duration-1000 supports-backdrop-filter:backdrop-blur-xs motion-safe:animate-[window-backdrop-in_var(--motion-companion-open)_var(--ease-companion)]",
          closing && "pointer-events-none opacity-0"
        )}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={cn(
          // Opening (2026-10-04): slides up / grows in on the companion
          // window's soft curve — see the window-*-in keyframes in globals.css.
          variant === "sheet"
            ? "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none sm:max-w-md sm:rounded-2xl sm:border motion-safe:animate-[window-sheet-in_var(--motion-companion-open)_var(--ease-companion)]"
            : "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm motion-safe:animate-[window-dialog-in_var(--motion-companion-open)_var(--ease-companion)]",
          className
        )}
      >
        <div ref={dragHandleRef} className="space-y-2">
          {variant === "sheet" ? (
            <div className="mx-auto -mt-1 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden="true" />
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div id={titleId} className="min-w-0 flex-1 space-y-1 font-heading text-base leading-tight font-medium">
              {title}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.minimizeForm")}
                onClick={() => void minimizeAnimated()}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={closeAnimated}>
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
