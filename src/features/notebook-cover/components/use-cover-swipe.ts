import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { angleFromProgress, bookPoseFromAngle, coverShading, coverSideShowing, coverReleaseDuration, coverReleaseEasing, isTap, progressFromDrag, shouldOpenOnRelease } from "../cover-swipe";

/** Imperative animation keeps pointer movement out of React's render path. */
export function useCoverSwipe(onSwipeOpen: () => void, onTapOpen: () => void) {
  const face = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const angle = useRef(0);
  const latestDx = useRef(0);
  const suppressClick = useRef(false);
  const busy = useRef(false);
  const gesture = useRef<{
    id: number; x: number; y: number; width: number; moved: boolean;
    samples: { x: number; time: number }[]; reduced: boolean;
  } | null>(null);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
  }, []);

  /** The cover and the book under it move together, so both get a layer. */
  function promote(node: HTMLElement | null, on: boolean) {
    const value = on ? "transform" : "";
    if (node) node.style.willChange = value;
    if (node?.parentElement) node.parentElement.style.willChange = value;
  }

  function paint(value: number) {
    const node = face.current;
    if (!node) return;
    angle.current = value;
    node.style.transform = `rotateY(${value}deg)`;
    const shading = coverShading(value);
    const stage = node.parentElement;
    if (stage) stage.style.transform = bookPoseFromAngle(value);
    for (const key of ["front", "back", "page"] as const) {
      stage?.style.setProperty(`--cover-${key}`, String(shading[key]));
    }
    const side = coverSideShowing(value);
    stage?.style.setProperty("--cover-front-visibility", side === "front" ? "visible" : "hidden");
    stage?.style.setProperty("--cover-back-visibility", side === "back" ? "visible" : "hidden");
  }

  function reset() {
    paint(0);
    if (face.current) {
      face.current.style.transform = "";
      promote(face.current, false);
    }
  }

  function settle(open: boolean, reduced: boolean) {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    const node = face.current;
    if (!node) return;
    if (reduced) {
      reset();
      if (open) onSwipeOpen();
      return;
    }
    busy.current = true;
    const from = angle.current;
    const target = open ? -180 : 0;
    const duration = coverReleaseDuration(from, open);
    const start = performance.now();
    // Keep the layer promoted through the tween; reset() / unmount clears it.
    promote(node, true);
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      paint(from + (target - from) * coverReleaseEasing(progress, open));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        frame.current = 0;
        busy.current = false;
        if (open) {
          promote(node, false);
          onSwipeOpen();
        } else reset();
      }
    }
    frame.current = requestAnimationFrame(tick);
  }

  function end(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    event.stopPropagation();
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const tap = !current.moved && isTap(dx, dy);
    suppressClick.current = cancelled || !tap;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const progress = progressFromDrag(dx, current.width);
    const recent = current.samples.filter(sample => event.timeStamp - sample.time <= 100);
    const first = recent[0];
    const velocityX = first ? (event.clientX - first.x) / Math.max(1, event.timeStamp - first.time) : 0;
    if (cancelled || !tap) {
      settle(!cancelled && shouldOpenOnRelease({ progress, velocityX, dx }), current.reduced);
    } else {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      reset();
    }
  }

  return {
    coverFaceRef: face,
    handlers: {
      onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
        if (!event.isPrimary || event.button !== 0 || busy.current || gesture.current) return;
        suppressClick.current = false;
        const node = face.current;
        if (!node) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        gesture.current = {
          id: event.pointerId, x: event.clientX, y: event.clientY,
          width: node.offsetWidth, moved: false, reduced,
          samples: [{ x: event.clientX, time: event.timeStamp }],
        };
        angle.current = 0;
        if (!reduced) promote(node, true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        current.moved ||= !isTap(dx, event.clientY - current.y);
        current.samples = current.samples.filter(sample => event.timeStamp - sample.time <= 100);
        current.samples.push({ x: event.clientX, time: event.timeStamp });
        if (current.reduced) return;
        latestDx.current = dx;
        if (!frame.current) frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          paint(angleFromProgress(progressFromDrag(latestDx.current, current.width)));
        });
      },
      onPointerUp: end,
      onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => end(event, true),
      onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => end(event, true),
      onClick(event: React.MouseEvent<HTMLButtonElement>) {
        event.stopPropagation();
        // Keyboard clicks have detail=0 and remain available after a cancelled drag.
        if (busy.current || (event.detail !== 0 && suppressClick.current)) {
          event.preventDefault();
          return;
        }
        onTapOpen();
      },
      // Portals bubble through the React tree: isolate underlying touch navigation too.
      onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => event.stopPropagation(),
      onTouchMove: (event: React.TouchEvent<HTMLButtonElement>) => event.stopPropagation(),
      onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => event.stopPropagation(),
      onTouchCancel: (event: React.TouchEvent<HTMLButtonElement>) => event.stopPropagation(),
    },
  };
}
