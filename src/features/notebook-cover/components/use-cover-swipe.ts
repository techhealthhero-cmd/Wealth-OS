import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { angleFromProgress, isTap, progressFromDrag, shouldOpenOnRelease } from "../cover-swipe";

/** Imperative animation keeps pointer movement out of React's render path. */
export function useCoverSwipe(onSwipeOpen: () => void, onTapOpen: () => void) {
  const face = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const busy = useRef(false);
  const gesture = useRef<{
    id: number; x: number; y: number; width: number; moved: boolean;
    samples: { x: number; time: number }[]; reduced: boolean;
  } | null>(null);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function settle(progress: number, open: boolean, reduced: boolean) {
    cancelAnimationFrame(frame.current);
    const node = face.current;
    if (!node) return;
    if (reduced) {
      node.style.transform = "";
      node.style.willChange = "";
      if (open) onSwipeOpen();
      return;
    }
    busy.current = true;
    const duration = open ? 220 : 380;
    // Flush the final finger position before starting the release transition.
    node.style.transform = `rotateY(${angleFromProgress(progress)}deg)`;
    frame.current = requestAnimationFrame(() => {
      node.style.transition = `transform ${duration}ms ${open ? "ease-out" : "cubic-bezier(.2,.9,.3,1.12)"}`;
      node.style.transform = `rotateY(${open ? -180 : 0}deg)`;
      timer.current = setTimeout(() => {
        node.style.willChange = "";
        node.style.transition = "";
        busy.current = false;
        timer.current = null;
        if (open) onSwipeOpen();
      }, duration);
    });
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
      settle(progress, !cancelled && shouldOpenOnRelease({ progress, velocityX, dx }), current.reduced);
    } else {
      cancelAnimationFrame(frame.current);
      if (face.current) {
        face.current.style.transform = "";
        face.current.style.willChange = "";
      }
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
        node.style.transition = "";
        if (!reduced) node.style.willChange = "transform";
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
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          if (face.current) face.current.style.transform = `rotateY(${angleFromProgress(progressFromDrag(dx, current.width))}deg)`;
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
