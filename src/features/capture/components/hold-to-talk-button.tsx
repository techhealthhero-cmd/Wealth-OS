"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

/** A press shorter than this is a tap: it latches listening on until the next tap. */
const TAP_MS = 350;

/**
 * The big center mic. Hold to talk and release to stop (walkie-talkie
 * style) — or tap once to start and tap again to stop, which also makes it
 * usable from a keyboard or switch control (Space / Enter toggle).
 */
export function HoldToTalkButton({
  listening,
  disabled,
  onStart,
  onStop,
}: {
  listening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const pressedAt = useRef<number | null>(null);
  // Is a finger holding the button right now? Drives the hint: "release to
  // stop" only while actually held, otherwise "tap to stop" — the old
  // latch flag could be stale and showed "release" after the finger lifted.
  const [fingerDown, setFingerDown] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!listening) return;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [listening]);

  function press() {
    if (disabled) return;
    if (listening) {
      // Second tap on a latched session stops it.
      pressedAt.current = null;
      onStop();
      return;
    }
    pressedAt.current = Date.now();
    setFingerDown(true);
    navigator.vibrate?.(10);
    onStart();
  }

  function release() {
    setFingerDown(false);
    if (pressedAt.current === null) return;
    const heldFor = Date.now() - pressedAt.current;
    pressedAt.current = null;
    // A quick tap latches listening on (tap again to stop); a hold stops on release.
    if (heldFor >= TAP_MS) onStop();
  }

  const label = listening ? t("capture.recap.micStop") : t("capture.recap.micStart");
  const hint = listening ? (fingerDown ? t("capture.recap.listeningHold") : t("capture.recap.listeningTap")) : t("capture.recap.micHold");
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex size-24 items-center justify-center">
        {listening ? (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 motion-reduce:animate-none" aria-hidden="true" />
            <span className="absolute -inset-2 rounded-full bg-primary/10" aria-hidden="true" />
          </>
        ) : null}
        <button
          type="button"
          aria-label={label}
          aria-pressed={listening}
          disabled={disabled}
          // Holding the mic and letting the finger drift must never pull the sheet closed.
          data-sheet-nodrag=""
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            press();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          // No synthetic "click" after the touch: when the sheet re-laid out
          // under the finger, iOS delivered it to whatever was there — an
          // example chip, which filled the box before a word was spoken
          // (reported 2026-10-05). The mic works purely from pointer events.
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
          }}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key !== " " && e.key !== "Enter") return;
            e.preventDefault();
            if (e.repeat) return;
            if (listening) onStop();
            else onStart();
          }}
          className={cn(
            "relative flex size-20 touch-none select-none items-center justify-center rounded-full text-primary-foreground shadow-[0_12px_28px_-10px_color-mix(in_oklab,var(--primary)_80%,transparent)] [-webkit-touch-callout:none]",
            "transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 motion-reduce:transition-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            listening ? "scale-105 bg-destructive" : "bg-primary"
          )}
          style={
            listening
              ? undefined
              : { background: "radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.22), transparent 60%), var(--primary)" }
          }
        >
          {listening ? <Square className="size-7 fill-current" aria-hidden="true" /> : <Mic className="size-8" aria-hidden="true" />}
        </button>
      </div>
      <p className="min-h-5 text-center text-sm font-medium" aria-live="polite">
        {hint}
        {listening ? <span className="ml-1.5 tabular-nums text-muted-foreground">{time}</span> : null}
      </p>
    </div>
  );
}
