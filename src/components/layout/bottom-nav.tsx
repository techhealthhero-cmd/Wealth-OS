"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

import { NAV_ITEMS } from "./nav-items";
import { useActiveNavIndex } from "./use-active-nav-index";
import { buildNotchedBarPath, fitNotchToSlot, type NotchGeometry } from "./nav-notch-path";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";
import { QuickAdd } from "@/features/transactions/components/quick-add";

// "Classic FAB" style (requested 2026-09-30, reference image): a deep,
// near-black green bar with a soft top sheen, a brighter glossy green "+"
// floating in the notch, and the active tab marked only by bright white
// icon + label (no highlight box). Colors are derived from --primary so
// they follow the theme instead of hard-coded brand hexes.
// Journal (2026-10-08): forest-green leather with a stitched edge, and the
// "+" as a raised leather button with a muted-gold metal rim.
const BAR_BASE = "color-mix(in oklab, var(--journal-leather) 82%, #0a1410)";
// Voice capture (2026-10-10, chosen mockup "C"): the center button is a
// brass mic — polished gold disc, leather-green icon and rim.
const FAB_BG = "radial-gradient(circle at 35% 28%, #f1d79a, #c9a052 58%, #9c7631)";
// Fallback before the first measurement (plain rounded bar, no notch).
const BAR_FALLBACK_BG = `radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.12), transparent 70%), ${BAR_BASE}`;

// The bar's top edge dips into a smooth U-shaped valley around the
// permanent center "+", whose circle floats inside it with a visible gap
// ring (see nav-notch-path.ts). fitNotchToSlot shrinks it on narrow phones.
const PREFERRED_NOTCH: NotchGeometry = { notchRadius: 30, centerY: 2, fillet: 16, minFillet: 5 };
const CIRCLE_GAP_PX = 5;
const BAR_CORNER_RADIUS_PX = 24;
const NAV_PADDING_X_PX = 8; // keep in sync with the <nav>'s `px-2`

export function BottomNav() {
  const activeIndex = useActiveNavIndex();
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // The SVG notch path needs real pixel sizes (arcs can't be stretched with
  // preserveAspectRatio="none" without distorting the circles).
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev && prev.width === rect.width && prev.height === rect.height ? prev : { width: rect.width, height: rect.height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A permanently-raised "+" (quick add) sits in the CENTER slot, with the
  // 4 real tabs split 2-and-2 around it; AI lives in its own floating button.
  const totalSlots = NAV_ITEMS.length + 1;
  const centerSlotIndex = Math.floor(NAV_ITEMS.length / 2);

  const innerWidth = size ? size.width - NAV_PADDING_X_PX * 2 : 0;
  const slotWidth = innerWidth / totalSlots;
  const slotCenterX = (slot: number) => NAV_PADDING_X_PX + (slot + 0.5) * slotWidth;

  const centerX = size ? slotCenterX(centerSlotIndex) : null;

  // Shrinks on very narrow phones only (see fitNotchToSlot).
  const notch = size ? fitNotchToSlot(PREFERRED_NOTCH, slotWidth) : PREFERRED_NOTCH;
  const circleRadius = notch.notchRadius - CIRCLE_GAP_PX;
  const notchXs = centerX !== null ? [centerX] : [];
  const barPath = size ? buildNotchedBarPath(size.width, size.height, BAR_CORNER_RADIUS_PX, notchXs, notch) : null;

  const circleStyle = (x: number) => ({
    left: x - circleRadius,
    top: notch.centerY - circleRadius,
    width: circleRadius * 2,
    height: circleRadius * 2,
    background: FAB_BG,
  });

  return (
    // Floating pill inset from the screen edges; every page reserves bottom
    // clearance for it (`pb-24` / `pb-[calc(6rem+...)]`).
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
      {/* Progressive "frosted glass" fade behind the pill, confined to the
          nav wrapper's own box so it never blurs page cards above it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/95 to-transparent"
      />
      <nav
        ref={navRef}
        // `isolate`: gives this element its own stacking context so the bar
        // layer's `-z-10` stays behind the icons instead of escaping behind
        // the whole page.
        //
        // `opacity-95` (requested): applied to the whole <nav> as one group
        // so the bar and the floating circles fade together evenly.
        className="group/nav isolate relative mx-auto flex max-w-md items-center justify-between px-2 py-1.5 opacity-95"
        aria-label="Primary"
      >
        {/* Bar background: an SVG path with the notches cut into its top
            edge (see nav-notch-path.ts). Before the first measurement
            (server render / first paint) it falls back to a plain pill. */}
        {barPath && size ? (
          <svg
            aria-hidden="true"
            className="absolute inset-0 -z-10 overflow-visible drop-shadow-[0_6px_16px_rgba(0,0,0,0.22)]"
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
          >
            <defs>
              <radialGradient id="bottom-nav-sheen" cx="50%" cy="-20%" r="120%" fx="50%" fy="-20%">
                <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                <stop offset="70%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d={barPath} style={{ fill: BAR_BASE }} />
            <path d={barPath} fill="url(#bottom-nav-sheen)" />
            {/* Stitching ~4px inside the edge: a wide dashed stroke clipped to
                the bar, then a narrower solid stroke in the bar color covering
                its outer part, leaving one thin dashed seam. */}
            <clipPath id="bottom-nav-clip">
              <path d={barPath} />
            </clipPath>
            <g clipPath="url(#bottom-nav-clip)" fill="none">
              <path d={barPath} stroke="var(--journal-stitch)" strokeWidth={11} strokeDasharray="5 4" />
              <path d={barPath} style={{ stroke: BAR_BASE }} strokeWidth={7} />
            </g>
          </svg>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-3xl shadow-card"
            style={{ background: BAR_FALLBACK_BG }}
          />
        )}

        {Array.from({ length: totalSlots }, (_, slot) => {
          if (slot === centerSlotIndex) {
            return <QuickAdd key="quick-add" variant="nav-center" />;
          }
          const tabIndex = slot < centerSlotIndex ? slot : slot - 1;
          const item = NAV_ITEMS[tabIndex];
          const active = tabIndex === activeIndex;
          return (
            <Link
              key={item.key}
              href={item.href}
              // Pressing compresses the whole target quickly, then the
              // overshooting release curve gives it a soft, springy button
              // feel. The inset shade supplies depth without changing the
              // existing notch geometry.
              className={cn(
                "group/nav-item relative z-10 flex flex-1 touch-manipulation select-none flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium",
                "transform-gpu transition-[transform,box-shadow,background-color,color,filter] duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
                "active:translate-y-0.5 active:scale-[0.94] active:brightness-95 active:shadow-[inset_0_3px_7px_rgba(0,0,0,0.2)] active:duration-75 active:ease-out",
                "motion-reduce:transform-none motion-reduce:transition-colors",
                active ? "font-semibold text-white active:bg-white/10" : "text-white/55 active:bg-white/10"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon
                className="h-5 w-5 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-active/nav-item:scale-90 group-active/nav-item:duration-75 motion-reduce:transform-none"
                aria-hidden="true"
              />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}

        {/* Permanent center "+" circle, floating in its own notch (it's an
            action, not a destination — never tied to route match). The real
            click target is QuickAdd's invisible trigger underneath. */}
        {centerX !== null ? (
          <div
            aria-hidden="true"
            // Soft press: while QuickAdd's trigger is :active the circle
            // sinks (scale + 2px down), its glow tightens and an inner shade
            // appears — quick ease-out going in, then an overshooting spring
            // curve on release so it "bounces back" like a cushioned button.
            className={cn(
              "pointer-events-none absolute flex items-center justify-center rounded-full border border-white/25",
              "shadow-[0_0_0_2px_var(--journal-leather),0_8px_18px_-4px_color-mix(in_oklab,var(--primary)_70%,transparent),inset_0_1px_0_rgba(255,255,255,0.35)]",
              "transform-gpu transition-[transform,box-shadow,filter] duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
              "group-has-[[data-fab-trigger]:active]/nav:translate-y-0.5 group-has-[[data-fab-trigger]:active]/nav:scale-[0.88] group-has-[[data-fab-trigger]:active]/nav:brightness-95",
              "group-has-[[data-fab-trigger]:active]/nav:shadow-[0_0_0_2px_var(--journal-leather),0_3px_8px_-3px_color-mix(in_oklab,var(--primary)_70%,transparent),inset_0_3px_8px_rgba(0,0,0,0.25)]",
              "group-has-[[data-fab-trigger]:active]/nav:duration-150 group-has-[[data-fab-trigger]:active]/nav:ease-out",
              "group-has-[[data-fab-trigger]:focus-visible]/nav:ring-2 group-has-[[data-fab-trigger]:focus-visible]/nav:ring-white/70",
              "motion-reduce:transition-none"
            )}
            // Read by QuickCaptureSheet to aim its grow/shrink at this circle.
            data-fab-circle=""
            style={circleStyle(centerX)}
          >
            <Mic
              strokeWidth={2.4}
              className="size-7 text-[var(--journal-leather-deep)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-has-[[data-fab-trigger]:active]/nav:scale-90 group-has-[[data-fab-trigger]:active]/nav:duration-150 motion-reduce:transition-none"
            />
          </div>
        ) : null}
      </nav>
    </div>
  );
}
