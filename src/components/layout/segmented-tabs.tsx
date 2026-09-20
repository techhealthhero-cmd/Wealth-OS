"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  href: string;
  label: string;
  /** Overrides the default `pathname.startsWith(href)` match — needed for an index route like /earn, where every other tab's href would also satisfy startsWith("/earn"). */
  isActive?: (pathname: string) => boolean;
}

/**
 * Shared segmented-control tab bar — MoneyTabs/PlanTabs/EarnTabs were three
 * copy-pasted, near-identical implementations (a plain color-swap on the
 * active pill, no shared component) that had started to drift (EarnTabs
 * was missing the duration/easing tokens the other two had). Requested:
 * make it feel more "modern, premium, Apple" — the concrete gap versus a
 * real iOS segmented control was the missing sliding indicator (switching
 * tabs here just swapped a background color instantly; Apple's own
 * control animates the selected pill sliding to its new position).
 *
 * The pill's position/width are measured from the actual active tab's DOM
 * node (a ref per tab, not the container's raw children index — the
 * indicator itself is also a child, which would throw off any index-based
 * lookup) and animated via `transform: translateX()` + `width`, matching
 * this app's existing "animate transform/opacity, not layout properties"
 * convention (see globals.css's motion-system comment).
 */
export function SegmentedTabs({ tabs }: { tabs: SegmentedTabItem[] }) {
  const pathname = usePathname();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = tabs.findIndex((tab) => (tab.isActive ? tab.isActive(pathname) : pathname.startsWith(tab.href)));

  useEffect(() => {
    function measure() {
      const el = tabRefs.current[activeIndex];
      if (!el) return;
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }

    measure();
    // Web fonts can still be settling on first paint, shifting tab widths
    // a frame late — one more measurement after layout catches that.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex, tabs.length]);

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="relative inline-flex w-max gap-1 rounded-full bg-muted/70 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
        {indicator ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-0 rounded-full bg-background shadow-md ring-1 ring-black/5 transition-[transform,width] duration-(--motion-normal) ease-(--ease-standard)"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          />
        ) : null}
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className={cn(
                "relative z-10 shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors duration-(--motion-normal) ease-(--ease-standard)",
                active ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
