"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

// A press held longer than this is the list's long-press-to-drag (see
// sortable-account-list.tsx's 250ms activation delay), not a tap to flip.
const TAP_MAX_MS = 250;

/**
 * A card that flips: tap it to turn it over to a back that shows what the
 * money is instead of how much (for showing the app to someone without it
 * looking hidden), tap again to turn it back. Both faces share one grid cell,
 * so the card keeps its height through the turn. `front` and `back` are
 * usually a <Card> each; `children` (dialogs) render outside both faces so
 * they're never inert.
 *
 * Keyboard and screen-reader users flip with one visually hidden toggle
 * button outside the faces — the card itself isn't a button, since the
 * front holds the ⋮ menu button.
 */
export function FlipCard({
  front,
  back,
  closed,
  onToggle,
  name,
  children,
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  closed: boolean;
  onToggle: (closed: boolean) => void;
  /** What the card is (account/asset/debt name), for the toggle's label. */
  name: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  // Only animate flips the viewer makes: a card remembered as closed
  // appears closed on load instead of spinning shut.
  const [animate, setAnimate] = useState(false);
  const pressStart = useRef(0);

  function flip() {
    setAnimate(true);
    onToggle(!closed);
  }

  function handleTap(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Clicks bubble here from the portalled menu and dialogs too (React
    // events follow the component tree), and the ⋮ button has its own job.
    if (!event.currentTarget.contains(target) || target.closest("button, a, input, textarea, select")) return;
    if (Date.now() - pressStart.current > TAP_MAX_MS) return;
    flip();
  }

  return (
    <div
      className="relative cursor-pointer rounded-xl perspective-[1200px] has-[[data-flip-toggle]:focus-visible]:ring-2 has-[[data-flip-toggle]:focus-visible]:ring-ring has-[[data-flip-toggle]:focus-visible]:ring-offset-2 has-[[data-flip-toggle]:focus-visible]:ring-offset-background"
      onPointerDown={() => {
        pressStart.current = Date.now();
      }}
      onClick={handleTap}
    >
      <button
        type="button"
        data-flip-toggle
        className="sr-only"
        // One fixed label, the state in aria-pressed: a toggle whose label
        // also flipped would read as "Show amount…, pressed".
        aria-pressed={closed}
        aria-label={t("common.hideAmountFor").replace("{name}", name)}
        onClick={flip}
      />
      <div
        className={cn(
          "grid transform-3d",
          animate && "transition-transform duration-500 ease-in-out motion-reduce:transition-none",
          closed && "rotate-y-180"
        )}
      >
        <div className="col-start-1 row-start-1 grid backface-hidden" inert={closed} aria-hidden={closed}>
          {front}
        </div>
        <div className="col-start-1 row-start-1 grid rotate-y-180 backface-hidden" inert={!closed} aria-hidden={!closed}>
          {back}
        </div>
      </div>
      {children}
    </div>
  );
}
