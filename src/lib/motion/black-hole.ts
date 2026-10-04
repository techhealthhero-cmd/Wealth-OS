"use client";

/**
 * "Black Hole" — the app's named motion for something being STORED into a
 * visible destination (GRAPHICS_PLAN.md → Named window motions): the
 * element accelerates into the target, spinning slightly, rounding into a
 * disc, blurring and fading, and the target then "gulps" (a short swell).
 *
 * Use it only when (1) the destination is on screen and (2) something was
 * successfully kept there — never for deleting (being sucked into a void
 * reads as money disappearing).
 *
 * Scaling about an origin placed on the target makes every point of the
 * element converge on that target, so the same function works whether the
 * element sits on top of the target (a form closing into its button) or far
 * away from it (an amount chip flying into a progress bar).
 *
 * Implemented with the Web Animations API so it works on any element
 * without CSS state attributes. Durations/curves mirror the tokens in
 * globals.css (--motion-companion-close, --ease-black-hole).
 */
export const BLACK_HOLE_MS = 680;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Pulls `el` into `target`. Resolves when the element has vanished (it
 * stays hidden — the caller removes/unmounts it).
 *
 * The path is explicit rather than "scale toward an origin": the element
 * first travels most of the way to the target while still readable, then
 * collapses hard at the end and only fades in the last moment. (Scaling
 * about a far-away origin made a distant element fade out halfway there —
 * it never visibly reached the progress bar.)
 */
export function blackHoleInto(el: HTMLElement, target: Element): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  const rect = el.getBoundingClientRect();
  const c = centerOf(target);
  const dx = c.x - (rect.left + rect.width / 2);
  const dy = c.y - (rect.top + rect.height / 2);
  el.style.transformOrigin = "50% 50%";
  const radius = getComputedStyle(el).borderRadius || "0px";
  const at = (p: number, scale: number, deg: number) =>
    `translate(${dx * p}px, ${dy * p}px) rotate(${deg}deg) scale(${scale})`;
  const anim = el.animate(
    [
      { transform: at(0, 1, 0), filter: "blur(0px)", opacity: 1, borderRadius: radius, easing: "cubic-bezier(0.4, 0, 0.9, 0.6)" },
      { transform: at(0.55, 0.72, -5), filter: "blur(1px)", opacity: 1, offset: 0.5, easing: "cubic-bezier(0.5, 0, 0.9, 0.5)" },
      { transform: at(0.94, 0.22, -11), filter: "blur(3px)", opacity: 1, borderRadius: "50%", offset: 0.84, easing: "ease-in" },
      { transform: at(1, 0.02, -14), filter: "blur(6px)", opacity: 0, borderRadius: "50%" },
    ],
    { duration: BLACK_HOLE_MS, fill: "forwards" }
  );
  return anim.finished.then(
    () => undefined,
    () => undefined
  );
}

/** The destination's swallow — a short swell, then settle. `amount` is the peak scale. */
export function gulp(target: Element, amount = 1.12): void {
  if (prefersReducedMotion() || !(target instanceof HTMLElement)) return;
  target.animate(
    [{ transform: "scale(1)" }, { transform: `scale(${amount})`, offset: 0.45 }, { transform: "scale(1)" }],
    { duration: 460, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
  );
}

/**
 * Spawns a small pill showing `label` (e.g. "+฿2,000") at `from` (a viewport
 * point), then pulls it into `target` and gulps the target. For storing an
 * amount into something that isn't a window (an inline form saving into a
 * progress bar).
 */
export async function flyAmountInto(label: string, from: { x: number; y: number }, target: Element): Promise<void> {
  if (prefersReducedMotion()) return;
  const chip = document.createElement("div");
  chip.textContent = label;
  chip.setAttribute("aria-hidden", "true");
  Object.assign(chip.style, {
    position: "fixed",
    left: `${from.x}px`,
    top: `${from.y}px`,
    translate: "-50% -50%",
    zIndex: "70",
    padding: "8px 16px",
    borderRadius: "9999px",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    font: "600 15px/1.2 var(--font-sans, sans-serif)",
    boxShadow: "0 8px 24px -6px color-mix(in oklab, var(--primary) 70%, transparent)",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(chip);
  // A brief pop-in so the amount is readable before it's swallowed.
  await chip
    .animate([{ opacity: 0, transform: "scale(0.8)" }, { opacity: 1, transform: "scale(1)" }], {
      duration: 260,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    })
    .finished.catch(() => undefined);
  await new Promise((r) => setTimeout(r, 220));
  await blackHoleInto(chip, target);
  chip.remove();
  gulp(target, 1.06);
}
