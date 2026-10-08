"use client";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { useActiveNavIndex } from "./use-active-nav-index";

const TAB_COLOR: Record<string, string> = {
  home: "var(--journal-tab-home)",
  money: "var(--journal-tab-money)",
  plan: "var(--journal-tab-plan)",
  earn: "var(--journal-tab-earn)",
};

/**
 * WEALTH OS Journal: colored divider tabs on the right edge of the
 * notebook, one per main section, sticking out past the page edge onto the
 * leather cover (v2, 2026-10-09 — thicker, like the mockup); the current
 * section's tab sticks out further.
 *
 * Deliberately a visual marker only, not a second navigation: the bottom
 * nav already moves between sections, and two ways to do the same thing
 * adds decisions (UX_GUIDELINES.md #6). It sits over the cover margin and
 * the page's padding, never over content, and ignores touches.
 */
export function JournalSectionTabs() {
  const activeIndex = useActiveNavIndex();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+8rem)] right-0 z-20 flex flex-col gap-2"
    >
      {NAV_ITEMS.map((item, i) => {
        const active = i === activeIndex;
        return (
          <span
            key={item.key}
            className={cn(
              "ml-auto block h-[52px] rounded-r-[5px] transition-[width] duration-(--motion-normal) ease-(--ease-standard)",
              // Paper-tab shading: a lighter top edge, a darker underside and
              // a small shadow onto the cover.
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.12),1px_2px_3px_rgba(0,0,0,0.35)]",
              active ? "w-[22px]" : "w-[16px] opacity-90"
            )}
            style={{ backgroundColor: TAB_COLOR[item.key] }}
          />
        );
      })}
    </div>
  );
}
