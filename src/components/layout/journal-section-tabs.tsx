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
 * WEALTH OS Journal (2026-10-08): colored divider tabs on the right edge of
 * the notebook, one per main section, with the current section's tab
 * sticking out further — plus the thin edges of the stacked pages behind.
 *
 * Deliberately a visual marker only, not a second navigation: the bottom
 * nav already moves between sections, and two ways to do the same thing
 * adds decisions (UX_GUIDELINES.md #6). It sits inside the page's 16px
 * gutter, so it never covers content, and ignores touches.
 */
export function JournalSectionTabs() {
  const activeIndex = useActiveNavIndex();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 z-20 w-3">
      {/* Stacked page edges */}
      <div
        className="absolute inset-y-0 right-0 w-[5px]"
        style={{
          background:
            "linear-gradient(to left, var(--journal-edge) 0 1px, transparent 1px 2px, var(--journal-edge) 2px 3px, transparent 3px)",
        }}
      />
      <div className="absolute top-[calc(env(safe-area-inset-top)+8.5rem)] right-0 flex flex-col gap-1.5">
        {NAV_ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <span
              key={item.key}
              className={cn(
                "ml-auto block h-11 rounded-l-md shadow-[inset_1px_0_0_rgba(255,255,255,0.35),-1px_1px_2px_rgba(92,70,38,0.18)] transition-[width,opacity] duration-(--motion-normal) ease-(--ease-standard)",
                active ? "w-3 opacity-100" : "w-1.5 opacity-75"
              )}
              style={{ backgroundColor: TAB_COLOR[item.key] }}
            />
          );
        })}
      </div>
    </div>
  );
}
