"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  href: string;
  label: string;
  icon?: LucideIcon;
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
 *
 * Visual style: "modern" icon tabs — a faintly mint-tinted card holding
 * icon-over-label tabs, the active one a sliding solid-green tile (went
 * pill → underline → this, each on request). With 8 Money tabs the row
 * overflows on mobile, so the active tab is also scrolled into view.
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
    tabRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
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
    <nav className="overflow-x-auto rounded-3xl bg-linear-to-b from-card to-primary/4 p-1.5 shadow-[0_6px_24px_-10px_color-mix(in_oklab,var(--primary)_35%,transparent)] ring-1 ring-primary/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="relative flex min-w-max gap-1">
        {indicator ? (
          // Same solid-primary + top sheen as the bottom nav bar, so the
          // active section tab reads as part of one navigation family.
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-2xl shadow-[0_6px_14px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-[transform,width] duration-(--motion-normal) ease-(--ease-standard)"
            style={{
              width: indicator.width,
              transform: `translateX(${indicator.left}px)`,
              background:
                "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.22), transparent 70%), var(--primary)",
            }}
          />
        ) : null}
        {tabs.map((tab, i) => {
          const active = i === activeIndex;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              className={cn(
                "relative flex min-w-18 shrink-0 flex-col items-center gap-1 whitespace-nowrap rounded-2xl px-3 py-2 text-xs transition-colors duration-(--motion-normal) ease-(--ease-standard) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "font-semibold text-primary-foreground" : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon ? (
                <Icon
                  className={cn("size-5", !active && "text-primary/70")}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
              ) : null}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
