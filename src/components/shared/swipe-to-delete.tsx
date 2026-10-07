"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Width of the revealed "ลบ" button when a row is swiped part-way and left open. */
const REVEAL = 88;
/** Swiped past this share of the row's width → delete on release. */
const FULL_SWIPE_RATIO = 0.45;
const FLICK_VELOCITY = 0.6; // px/ms
const FLICK_MIN = 60;
const SETTLE = "transform 200ms ease-out";

/**
 * iPhone-style swipe to delete, in either direction. The row follows the
 * finger horizontally (vertical scrolling is untouched: touch-action
 * pan-y); a long swipe or a quick flick deletes, a shorter one leaves a
 * red "ลบ" button showing. Swipes never trigger the row's own buttons.
 * A visually hidden button keeps delete reachable without swiping
 * (keyboard, VoiceOver, switch control).
 *
 * With `onEdit` (requested 2026-10-03 for the transaction list): swiping
 * RIGHT edits instead — a green "แก้ไข" action on the left; a long swipe
 * or flick opens the editor and the row springs back, a shorter one leaves
 * the button open to tap. Swiping LEFT still deletes. Without `onEdit`
 * (Daily Inbox), both directions delete as before.
 */
export function SwipeToDelete({
  onDelete,
  deleteLabel,
  a11yLabel,
  onEdit,
  editLabel,
  children,
  className,
  as: Tag = "div",
}: {
  onDelete: () => void;
  onEdit?: () => void;
  /** Visible on the edit action; required with `onEdit`. */
  editLabel?: string;
  /** Visible on the red action, and the accessible name of the delete control. */
  deleteLabel: string;
  /** Fuller name for the non-swipe delete control, e.g. "ลบ: ไก่ทอด ฿40". */
  a11yLabel?: string;
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const rowRef = useRef<HTMLElement | null>(null);
  const start = useRef<{ x: number; y: number; t: number; base: number } | null>(null);
  const mode = useRef<"none" | "h" | "v">("none");
  const swiped = useRef(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);

  function remove(direction: 1 | -1) {
    if (removing) return;
    setRemoving(true);
    setDragging(false);
    setOffset(direction * (rowRef.current?.offsetWidth ?? 400));
    window.setTimeout(onDelete, 200);
  }

  function edit() {
    setDragging(false);
    setOffset(0);
    onEdit?.();
  }

  // Right-hand swipe (positive offset) is "edit" only when an editor exists.
  const editSide = offset > 0 && onEdit !== undefined;
  const open = !dragging && Math.abs(offset) >= REVEAL - 1 && !removing;

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        rowRef.current = el;
      }}
      className={cn("relative overflow-hidden", removing && "pointer-events-none opacity-0 transition-opacity delay-150 duration-150", className)}
    >
      {/* The red action behind the row, on whichever side is revealed —
          only while moved, so it never peeks out around rounded corners. */}
      {offset !== 0 || dragging ? (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center px-6 text-sm font-semibold text-white",
          editSide ? "bg-primary text-primary-foreground" : "bg-destructive",
          offset >= 0 ? "justify-start" : "justify-end"
        )}
      >
        <span className="flex flex-col items-center gap-1">
          {editSide ? <Pencil className="size-5" /> : <Trash2 className="size-5" />}
          {editSide ? editLabel : deleteLabel}
        </span>
      </div>
      ) : null}
      {open ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => (editSide ? edit() : remove(offset > 0 ? 1 : -1))}
          className={cn("absolute inset-y-0 z-10", offset > 0 ? "left-0" : "right-0")}
          style={{ width: REVEAL }}
        />
      ) : null}

      <div
        className="relative touch-pan-y"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : SETTLE }}
        onPointerDown={(e) => {
          if (removing || (e.pointerType === "mouse" && e.button !== 0)) return;
          start.current = { x: e.clientX, y: e.clientY, t: performance.now(), base: offset };
          mode.current = "none";
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (mode.current === "none") {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            mode.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
            if (mode.current === "h") {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setDragging(true);
            }
          }
          if (mode.current !== "h") return;
          swiped.current = true;
          const width = rowRef.current?.offsetWidth ?? 400;
          setOffset(Math.max(-width, Math.min(width, s.base + dx)));
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          if (!s || mode.current !== "h") return;
          setDragging(false);
          const width = rowRef.current?.offsetWidth ?? 400;
          const final = Math.max(-width, Math.min(width, s.base + (e.clientX - s.x)));
          const velocity = (e.clientX - s.x) / Math.max(1, performance.now() - s.t);
          const direction: 1 | -1 = final >= 0 ? 1 : -1;
          const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(final) > FLICK_MIN && Math.sign(velocity) === direction;
          if (Math.abs(final) > width * FULL_SWIPE_RATIO || flick) {
            if (direction === 1 && onEdit) edit();
            else remove(direction);
          }
          else if (Math.abs(final) > REVEAL * 0.6) setOffset(direction * REVEAL);
          else setOffset(0);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          if (Math.abs(offset) < REVEAL) setOffset(0);
        }}
        // A swipe must never also tap the row's own buttons (✓, ✏️, category).
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
          } else if (open) {
            // Tapping an opened row closes it instead.
            e.preventDefault();
            e.stopPropagation();
            setOffset(0);
          }
        }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => remove(-1)}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-20 focus:rounded-full focus:bg-destructive focus:px-3 focus:py-1.5 focus:text-sm focus:font-semibold focus:text-white"
      >
        {a11yLabel ?? deleteLabel}
      </button>
    </Tag>
  );
}
