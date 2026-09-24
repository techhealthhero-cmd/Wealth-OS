"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Minus, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { useMinimizableForm } from "./minimizable-form-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// How far down a drag must go before releasing counts as "minimize" —
// same threshold pull-to-refresh.tsx uses, for a consistent feel.
const DISMISS_THRESHOLD_PX = 70;
// Below this, a touchmove is still ambiguous (could be a tap, a scroll
// starting inside the handle's hit area) — same dead-zone reasoning as
// pull-to-refresh.tsx: don't call preventDefault()/start visually
// dragging until there's real, deliberate downward movement.
const DRAG_START_THRESHOLD_PX = 6;

interface MinimizableFormShellProps {
  /** ReactNode, not just a string — some forms' headers are more than plain text (e.g. TransactionForm's type badge above the title). */
  title: ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** "dialog" (centered, matches ui/dialog.tsx) or "sheet" (bottom sheet with a drag handle, matches ui/sheet.tsx's side="bottom") — whichever the form used before adopting this shell. Defaults to "dialog". */
  variant?: "dialog" | "sheet";
}

/**
 * A custom modal shell — deliberately NOT built on the shadcn `Dialog`/
 * `Sheet` primitives (see minimizable-form-context.tsx's doc comment for
 * why: Base UI's Dialog unmounts its content on close, which would lose
 * whatever the user had typed). Visually matches `Dialog`/`Sheet` (same
 * classes, copied from src/components/ui/dialog.tsx and sheet.tsx) so a
 * form adopting this shell looks identical to before.
 *
 * Escape and backdrop click both MINIMIZE rather than close — this
 * component's whole purpose is to never silently discard a draft the
 * ordinary way a modal would. The header's explicit "X" is the only close
 * action, matching the close behavior every retrofitted form already had.
 *
 * Known, deliberate simplification: basic aria-modal/labelledby semantics,
 * not a full keyboard focus trap — reasonable for this first pass of new,
 * carefully-scoped infrastructure rather than a wholesale a11y rewrite.
 */
export function MinimizableFormShell({ title, onClose, children, className, variant = "dialog" }: MinimizableFormShellProps) {
  const { minimize, minimized } = useMinimizableForm();
  const { t } = useTranslation();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

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
      if (e.key === "Escape") minimize();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [minimized, minimize]);

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
        onClick={minimize}
        className="fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs"
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={cn(
          variant === "sheet"
            ? "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-popover p-4 text-sm text-popover-foreground shadow-lg outline-none sm:max-w-md sm:rounded-2xl sm:border"
            : "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm",
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
                onClick={minimize}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("common.close")} onClick={onClose}>
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
