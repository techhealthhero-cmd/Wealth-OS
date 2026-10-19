/** Observe streamed fallbacks without keeping a turn alive indefinitely. */
export function waitForNoSkeleton(el: HTMLElement, ready: () => void, timeoutMs: number): () => void {
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let done = false;
  const cancel = () => {
    done = true;
    observer?.disconnect();
    clearTimeout(timer);
  };
  const finish = () => {
    if (done) return;
    cancel();
    ready();
  };
  if (!el.querySelector('[data-slot="skeleton"]')) {
    finish();
  } else {
    observer = new MutationObserver(() => {
      if (!el.querySelector('[data-slot="skeleton"]')) finish();
    });
    observer.observe(el, { subtree: true, childList: true });
    timer = setTimeout(finish, timeoutMs);
  }
  return cancel;
}

export function finishPageAnimations(el: HTMLElement) {
  if (typeof el.getAnimations !== "function") return;
  for (const animation of el.getAnimations({ subtree: true })) {
    // CSS animations only: leave transitions and scripted effects alone.
    if (!("animationName" in animation) || animation.playState !== "running") continue;
    const iterations = animation.effect?.getTiming().iterations;
    if (iterations === undefined || !Number.isFinite(iterations)) continue;
    try {
      animation.finish();
    } catch {
      // Detached/unresolved timelines may become unfinishable during navigation.
    }
  }
}
