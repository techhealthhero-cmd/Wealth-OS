"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { NAV_ITEMS } from "./nav-items";
import { useActiveNavIndex } from "./use-active-nav-index";
import { buildNotchedBarPath, fitNotchToSlot, type NotchGeometry } from "./nav-notch-path";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";
import { QuickAdd } from "@/features/transactions/components/quick-add";
import type { Account, Category } from "@/types/database";

// Requested: a subtle glossy/lit-from-above sheen instead of a completely
// flat fill. Restrained on purpose (GRAPHICS_PLAN.md's flat button system
// is the default elsewhere; this component is a narrow, explicit exception).
const GLOSSY_PRIMARY_BG =
  "radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.16), transparent 70%), var(--primary)";

// The bar's top edge dips into a smooth U-shaped valley around the
// permanent center "+", whose circle floats inside it with a visible gap
// ring (see nav-notch-path.ts). Tabs themselves no longer get a notch —
// requested (2026-09-29, reference: dark pill with a light mint rounded
// box behind the selected tab): the active tab is marked by that mint
// highlight instead, while the "+" notch and circle stay exactly as they
// were.
const PREFERRED_NOTCH: NotchGeometry = { notchRadius: 26, centerY: 4, fillet: 16, minFillet: 5 };
const CIRCLE_GAP_PX = 5;
const BAR_CORNER_RADIUS_PX = 24;
const NAV_PADDING_X_PX = 8; // keep in sync with the <nav>'s `px-2`
// Mint highlight: inset so it never touches the "+" notch's shoulders or
// the bar's rounded ends.
const HIGHLIGHT_INSET_X_PX = 4;
const HIGHLIGHT_INSET_Y_PX = 4;
// A light mint derived from the theme (primary-foreground tinted with a
// little primary), so it follows light/dark mode instead of a hard-coded hex.
const MINT_HIGHLIGHT_BG =
  "linear-gradient(180deg, color-mix(in oklab, var(--primary-foreground) 96%, var(--primary)), color-mix(in oklab, var(--primary-foreground) 82%, var(--primary)))";

export function BottomNav({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
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
  function tabIndexToSlot(tabIndex: number): number {
    return tabIndex < centerSlotIndex ? tabIndex : tabIndex + 1;
  }

  const innerWidth = size ? size.width - NAV_PADDING_X_PX * 2 : 0;
  const slotWidth = innerWidth / totalSlots;
  const slotCenterX = (slot: number) => NAV_PADDING_X_PX + (slot + 0.5) * slotWidth;

  // Routes that belong to no tab (e.g. /profile, /help) get no highlight
  // rather than faking an active tab.
  const hasActiveTab = activeIndex !== -1;
  const activeX = size && hasActiveTab ? slotCenterX(tabIndexToSlot(activeIndex)) : null;
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
    background: GLOSSY_PRIMARY_BG,
  });

  return (
    // Floating pill inset from the screen edges; every page reserves bottom
    // clearance for it (`pb-24` / `pb-[calc(6rem+...)]`).
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden">
      {/* Progressive "frosted glass" fade behind the pill, confined to the
          nav wrapper's own box so it never blurs page cards above it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-lg [-webkit-mask-image:linear-gradient(to_top,black_55%,transparent_100%)] [mask-image:linear-gradient(to_top,black_55%,transparent_100%)]"
      />
      <nav
        ref={navRef}
        // `isolate`: gives this element its own stacking context so the bar
        // layer's `-z-10` stays behind the icons instead of escaping behind
        // the whole page.
        //
        // `opacity-95` (requested): applied to the whole <nav> as one group
        // so the bar and the floating circles fade together evenly.
        className="isolate relative mx-auto flex max-w-md items-center justify-between px-2 py-1.5 opacity-95"
        aria-label="Primary"
      >
        {/* Bar background: an SVG path with the notches cut into its top
            edge (see nav-notch-path.ts). Before the first measurement
            (server render / first paint) it falls back to a plain pill. */}
        {barPath && size ? (
          <svg
            aria-hidden="true"
            className="absolute inset-0 -z-10 overflow-visible drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)]"
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
          >
            <defs>
              <radialGradient id="bottom-nav-sheen" cx="50%" cy="-20%" r="120%" fx="50%" fy="-20%">
                <stop offset="0%" stopColor="white" stopOpacity="0.16" />
                <stop offset="70%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d={barPath} fill="var(--primary)" />
            <path d={barPath} fill="url(#bottom-nav-sheen)" />
          </svg>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-3xl shadow-card"
            style={{ background: GLOSSY_PRIMARY_BG }}
          />
        )}

        {Array.from({ length: totalSlots }, (_, slot) => {
          if (slot === centerSlotIndex) {
            return <QuickAdd key="quick-add" accounts={accounts} categories={categories} variant="nav-center" />;
          }
          const tabIndex = slot < centerSlotIndex ? slot : slot - 1;
          const item = NAV_ITEMS[tabIndex];
          const active = tabIndex === activeIndex;
          return (
            <Link
              key={item.key}
              href={item.href}
              // `relative z-10`: paints above the sliding mint highlight.
              // Pressing compresses the whole target quickly, then the
              // overshooting release curve gives it a soft, springy button
              // feel. The inset shade supplies depth without changing the
              // existing notch/highlight geometry.
              className={cn(
                "group/nav-item relative z-10 flex flex-1 touch-manipulation select-none flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium",
                "transform-gpu transition-[transform,box-shadow,background-color,color,filter] duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
                "active:translate-y-0.5 active:scale-[0.94] active:brightness-95 active:shadow-[inset_0_3px_7px_rgba(0,0,0,0.2)] active:duration-75 active:ease-out",
                "motion-reduce:transform-none motion-reduce:transition-colors",
                active
                  ? "font-semibold text-primary active:bg-primary/10"
                  : "text-primary-foreground/80 active:bg-primary-foreground/10"
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

        {/* Mint highlight behind the active tab (reference design). One
            element that slides between tabs via a plain CSS transition on
            `left`, rather than a per-tab background that would just blink. */}
        {activeX !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.12)] transition-[left] duration-(--motion-normal) ease-(--ease-standard) motion-reduce:transition-none"
            style={{
              left: activeX - slotWidth / 2 + HIGHLIGHT_INSET_X_PX,
              width: slotWidth - HIGHLIGHT_INSET_X_PX * 2,
              top: HIGHLIGHT_INSET_Y_PX,
              bottom: HIGHLIGHT_INSET_Y_PX,
              background: MINT_HIGHLIGHT_BG,
            }}
          />
        ) : null}

        {/* Permanent center "+" circle, floating in its own notch (it's an
            action, not a destination — never tied to route match). The real
            click target is QuickAdd's invisible trigger underneath. */}
        {centerX !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center rounded-full shadow-card"
            style={circleStyle(centerX)}
          >
            <span className="text-2xl leading-none font-medium text-primary-foreground">+</span>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
