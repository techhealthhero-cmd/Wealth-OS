"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { AI_NAV_ITEM } from "./nav-items";
import { AiAssistantSheet } from "@/features/ai/components/ai-assistant-sheet";

const BUTTON_SIZE_PX = 56;
const EDGE_MARGIN_PX = 12;
// A real drag moves noticeably more than a finger's natural wobble during a
// tap; below this, releasing counts as a tap (navigate) rather than a drag
// (reposition) — mirrors the same "was this a tap or a drag" distinction
// BottomNav's swipe-nav gesture makes, just against a much smaller travel
// distance since this button is small and meant to feel tap-first.
const TAP_MAX_MOVEMENT_PX = 8;
const STORAGE_KEY = "wealth-os:ai-fab-position";

interface Position {
  x: number;
  y: number;
}

function clampPosition(pos: Position): Position {
  const maxX = window.innerWidth - BUTTON_SIZE_PX - EDGE_MARGIN_PX;
  const maxY = window.innerHeight - BUTTON_SIZE_PX - EDGE_MARGIN_PX;
  return {
    x: Math.min(Math.max(pos.x, EDGE_MARGIN_PX), Math.max(maxX, EDGE_MARGIN_PX)),
    y: Math.min(Math.max(pos.y, EDGE_MARGIN_PX), Math.max(maxY, EDGE_MARGIN_PX)),
  };
}

function loadStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") return parsed;
  } catch {
    // Corrupt/inaccessible storage — fall through to the default position.
  }
  return null;
}

function defaultPosition(): Position {
  // Bottom-right, comfortably above the bottom nav's floating pill (same
  // ~112px reservation every page's own content uses — see bottom-nav.tsx).
  return clampPosition({
    x: window.innerWidth - BUTTON_SIZE_PX - EDGE_MARGIN_PX,
    y: window.innerHeight - BUTTON_SIZE_PX - 150,
  });
}

/**
 * Requested: a draggable floating AI shortcut modeled directly on iOS's
 * AssistiveTouch — drag it anywhere on screen, tap (without dragging) to
 * open /ai. Replaces AI's old fixed slot in the bottom nav row, which was
 * removed to make room for a permanent center "+" (quick add) button
 * instead — see bottom-nav.tsx and nav-items.ts's AI_NAV_ITEM.
 *
 * Position is stored in pixels from the top-left, persisted across
 * sessions (localStorage) so it stays wherever the user last left it —
 * exactly like the real AssistiveTouch remembering its edge and vertical
 * position. Snaps to whichever horizontal edge is closer after a real drag
 * (not after a tap), the other real AssistiveTouch behavior this mirrors.
 *
 * Rendered only after mount (`position` starts `null`) — the stored/default
 * position depends on `window.innerWidth/innerHeight`, which doesn't exist
 * during SSR; rendering at a guessed position first and jumping after
 * hydration would be a visible flash, so this simply doesn't render until it
 * knows where it actually belongs.
 *
 * Requested again: tapping should open a floating chat widget over the
 * current page ("หน้าต่างลอยขึ้นมา") instead of navigating to /ai — see
 * AiAssistantSheet. The full /ai page still exists (reachable from the
 * sheet's own "open full page" link, or the desktop sidebar) for its extra
 * cards the quick overlay doesn't include.
 */
export function FloatingAiButton() {
  const pathname = usePathname();
  const [position, setPosition] = useState<Position | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const initial = loadStoredPosition() ?? defaultPosition();
    positionRef.current = initial;
    // Genuinely can't be known during render — depends on window
    // dimensions/localStorage, neither available server-side or on the
    // very first client render before hydration settles. This is the one
    // read of them, not a value that then keeps re-deriving every render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(initial);

    function handleResize() {
      const clamped = clampPosition(positionRef.current);
      positionRef.current = clamped;
      setPosition(clamped);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function persist(pos: Position) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // Storage unavailable (private mode, quota) — position just won't
      // survive a reload; not worth surfacing an error for.
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!positionRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > TAP_MAX_MOVEMENT_PX) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    const next = clampPosition({ x: drag.originX + dx, y: drag.originY + dy });
    positionRef.current = next;
    setPosition(next);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragStateRef.current = null;

    if (!drag.moved) {
      // A real tap, not a drag — opens the chat overlay in place.
      setSheetOpen(true);
      return;
    }

    // Snap to whichever horizontal edge is nearer, keep the dropped Y —
    // the other half of the AssistiveTouch behavior this mirrors.
    const current = positionRef.current;
    const viewportMidpoint = window.innerWidth / 2;
    const snappedX =
      current.x + BUTTON_SIZE_PX / 2 < viewportMidpoint
        ? EDGE_MARGIN_PX
        : window.innerWidth - BUTTON_SIZE_PX - EDGE_MARGIN_PX;
    const snapped = clampPosition({ x: snappedX, y: current.y });
    positionRef.current = snapped;
    setPosition(snapped);
    persist(snapped);
  }

  // Avoids cluttering the AI chat screen with a shortcut to itself. The
  // sheet still renders regardless (a fragment sibling, not nested inside
  // this check) so it can finish closing correctly even if something
  // navigated away from under it while open.
  const onAiPage = pathname === AI_NAV_ITEM.matchPrefix || pathname.startsWith(`${AI_NAV_ITEM.matchPrefix}/`);
  const showButton = !onAiPage && AI_NAV_ITEM.enabled && position;

  return (
    <>
      {showButton ? (
        <button
          type="button"
          aria-label="AI"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="fixed z-40 flex size-14 touch-none items-center justify-center rounded-full text-primary-foreground shadow-lg md:hidden"
          style={{
            left: position.x,
            top: position.y,
            background:
              "radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.16), transparent 70%), var(--primary)",
          }}
        >
          <AI_NAV_ITEM.icon className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}
      <AiAssistantSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
