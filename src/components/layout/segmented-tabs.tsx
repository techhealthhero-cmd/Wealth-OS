"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { SwipeTabPages, prefetchFull, type SwipeTabPagesHandle } from "./swipe-tab-pages";
import { tabStripMask, tabStripScrollTarget } from "./tab-strip-scroll";
import { bookNeighbour } from "./journal-book";

export interface SegmentedTabItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Overrides the default `pathname.startsWith(href)` match — needed for an index route like /earn, where every other tab's href would also satisfy startsWith("/earn"). */
  isActive?: (pathname: string) => boolean;
}

/**
 * Shared section tab strip, kept live outside the content page turn.
 * Colour and shadow transitions never animate tab layout.
 *
 * Visual style: notebook divider tabs (2026-10-15) — went pill → underline
 * → icon card → glossy sliding green tile → this, each on request; the
 * glossy tile read as a plastic button lying on the paper once pages
 * turned. Tab icons are no longer drawn (labels + page numbers instead);
 * `icon` stays on the item type for callers. With 8 Money tabs the row
 * overflows on mobile, so the active tab is also scrolled into view.
 */
/**
 * `stretch`: few tabs share the full width evenly (Earn has 3) instead of
 * hugging the left edge; scrolling bars with many tabs leave it off.
 */
export function SegmentedTabs({
  tabs,
  stretch = false,
  children,
}: {
  tabs: SegmentedTabItem[];
  stretch?: boolean;
  /** The section's page content: when given, it can be swiped left/right between these tabs with a page-turn (see SwipeTabPages). */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const activeIndex = tabs.findIndex((tab) => (tab.isActive ? tab.isActive(pathname) : pathname.startsWith(tab.href)));
  const pagesRef = useRef<SwipeTabPagesHandle>(null);
  const hrefKey = tabs.map((tab) => tab.href).join("|");
  const hrefs = useMemo(() => hrefKey.split("|"), [hrefKey]);

  // With 7–8 Money tabs the row overflows on mobile: keep the open one in view.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateMask = () => {
      const mask = tabStripMask(nav.scrollLeft, nav.clientWidth, nav.scrollWidth);
      nav.style.maskImage = mask;
      nav.style.webkitMaskImage = mask;
    };
    const reveal = () => {
      const tab = tabRefs.current[activeIndex];
      if (tab) {
        const target = tabStripScrollTarget(tab.offsetLeft, tab.offsetWidth, nav.scrollLeft, nav.clientWidth, nav.scrollWidth, 20);
        if (target !== null) nav.scrollLeft = target;
      }
      updateMask();
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    if (nav.firstElementChild) observer.observe(nav.firstElementChild);
    nav.addEventListener("scroll", updateMask, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", updateMask);
    };
  }, [activeIndex, hrefKey]);

  return (
    <>
      {/* Divider tabs (2026-10-15, mockup option A): paper tabs standing on
          the page's top edge, like a notebook's section dividers. The open
          one is the page itself — same paper, no seam — while the others
          sit behind it in the darker page-edge colour. 2026-10-19 (later): they turn with the title and content as
          one continuous sheet covering the whole visible main. */}
      <nav ref={navRef} className="relative overflow-x-auto pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          className={cn(
            "flex min-w-max items-end gap-0.5 border-b border-[color-mix(in_oklab,var(--journal-edge),var(--foreground)_22%)] px-1",
            stretch && "w-full"
          )}
        >
          {tabs.map((tab, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
              // Nearby tabs are prefetched in full by SwipeTabPages; any
              // other tab starts loading in full the moment a finger touches
              // it, before the tap is even released.
              onPointerDown={() => {
                if (!active) prefetchFull(router, tab.href);
              }}
                // Tapping a tab turns the page the same way a swipe does.
                onClick={(e) => {
                  if (active || activeIndex < 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  pagesRef.current?.beginFlip(i > activeIndex ? 1 : -1);
                }}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                className={cn(
                  stretch && "flex-1 justify-center",
                  "relative -mb-px flex shrink-0 touch-manipulation select-none items-baseline gap-1 whitespace-nowrap rounded-t-xl border border-b-0 border-[color-mix(in_oklab,var(--journal-edge),var(--foreground)_22%)] px-3.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "transition-[color,background-color,box-shadow] duration-(--motion-normal) ease-(--ease-standard) motion-reduce:transition-none",
                  active
                    ? // The page itself: its paper colour covers the strip's bottom edge, so tab and page are one sheet.
                      "z-10 bg-background pb-2 pt-2.5 font-bold text-foreground"
                    : "bg-(--journal-edge) py-1.5 font-medium text-muted-foreground shadow-[inset_0_-6px_8px_-6px_rgba(90,70,30,0.28)] hover:text-foreground active:translate-y-px dark:shadow-[inset_0_-6px_8px_-6px_rgba(0,0,0,0.5)]"
                )}
              >
                {/* Page number, like a divider's printed index. */}
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground" aria-hidden="true">
                  {i + 1}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children !== undefined ? (
        <SwipeTabPages
          hrefs={hrefs}
          activeIndex={activeIndex}
          handleRef={pagesRef}
          // The journal is one book: past this section's first/last tab the
          // swipe turns into the neighbouring section (or back to Home).
          prevHref={bookNeighbour(hrefs[0], -1)}
          nextHref={bookNeighbour(hrefs[hrefs.length - 1], 1)}
        >
          {children}
        </SwipeTabPages>
      ) : null}
    </>
  );
}
