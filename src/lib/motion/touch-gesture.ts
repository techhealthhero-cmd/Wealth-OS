/**
 * 2026-10-19: touch events keep their original target even after React removes
 * it. Listen there for one gesture, without depending on DOM ancestry.
 */
export function listenToTouchGesture<E extends Event>(
  target: EventTarget,
  onMove: (event: E) => void,
  onEnd: (event: E) => void,
): () => void {
  const move: EventListener = (event) => onMove(event as E);
  const end: EventListener = (event) => {
    dispose();
    onEnd(event as E);
  };
  function dispose() {
    target.removeEventListener("touchmove", move);
    target.removeEventListener("touchend", end);
    target.removeEventListener("touchcancel", end);
  }
  target.addEventListener("touchmove", move, { passive: false });
  target.addEventListener("touchend", end, { passive: true });
  target.addEventListener("touchcancel", end, { passive: true });
  return dispose;
}
