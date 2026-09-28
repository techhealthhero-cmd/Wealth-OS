"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { AI_NAV_ITEM } from "./nav-items";
import { X } from "lucide-react";

import { AiAssistantPanel } from "@/features/ai/components/ai-assistant-panel";
import { useAiFabIdleOpacity } from "./ai-fab-preferences";

const BUTTON_SIZE_PX = 56;
const EDGE_MARGIN_PX = 12;
// A real drag moves noticeably more than a finger's natural wobble during a
// tap; below this, releasing counts as a tap (navigate) rather than a drag
// (reposition) — mirrors the same "was this a tap or a drag" distinction
// BottomNav's swipe-nav gesture makes, just against a much smaller travel
// distance since this button is small and meant to feel tap-first.
const TAP_MAX_MOVEMENT_PX = 8;
const STORAGE_KEY = "wealth-os:ai-fab-position";
// Same idea as AssistiveTouch: untouched for this long → fade to the
// user's idle opacity (Settings → floating AI button).
const IDLE_DELAY_MS = 3000;

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
 * AiAssistantPanel, which floats next to this button. While it's open the
 * button stays above the panel's backdrop with a small "×" badge, and a tap
 * closes it again. The full /ai page still exists (the panel's "open full
 * page" link, or the desktop sidebar).
 */
export function FloatingAiButton() {
  const pathname = usePathname();
  const [position, setPosition] = useState<Position | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const idleOpacity = useAiFabIdleOpacity();
  const [active, setActive] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
    // Captured at press time: the panel's own outside-press handling may
    // close it before pointerup fires, which would otherwise make this tap
    // immediately re-open it.
    wasOpen: boolean;
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

  function scheduleIdle() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setActive(false), IDLE_DELAY_MS);
  }

  // Start the idle countdown on mount, and again whenever the panel closes.
  useEffect(() => {
    if (!sheetOpen) scheduleIdle();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [sheetOpen]);

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
    // Touched → fully visible again, and stays so until released + idle.
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
      wasOpen: sheetOpen,
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
    scheduleIdle();

    if (!drag.moved) {
      // A real tap, not a drag — toggles the chat overlay in place.
      setSheetOpen(!drag.wasOpen);
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
  const anchor = useMemo(
    () => (position ? { x: position.x, y: position.y, size: BUTTON_SIZE_PX } : null),
    [position]
  );

  return (
    <>
      {showButton ? (
        <button
          type="button"
          aria-label="AI"
          aria-expanded={sheetOpen}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`fixed flex size-14 touch-none items-center justify-center rounded-full text-primary-foreground shadow-lg transition-opacity duration-500 md:hidden ${
            sheetOpen ? "z-[60] ring-4 ring-primary/25" : "z-40"
          }`}
          style={{
            left: position.x,
            top: position.y,
            opacity: sheetOpen || active ? 1 : idleOpacity / 100,
            background:
              "radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.16), transparent 70%), var(--primary)",
          }}
        >
          <AI_NAV_ITEM.icon className="h-6 w-6" aria-hidden="true" />
          {sheetOpen ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full border bg-background text-foreground shadow-sm"
            >
              <X className="size-3" strokeWidth={3} />
            </span>
          ) : null}
        </button>
      ) : null}
      <AiAssistantPanel
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        anchor={anchor}
      />
    </>
  );
}
