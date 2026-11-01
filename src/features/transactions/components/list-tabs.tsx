"use client";

import { useLayoutEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type ListTab = "all" | "pending";

/** How long to keep the pre-switch scroll after the new tab commits. */
const SCROLL_HOLD_MS = 700;
/** Drop a captured offset that was never claimed by a committed tab. */
const SCROLL_HOLD_TTL_MS = 5000;
const SCROLL_HOLD_KEY = "finance-list-tab-scroll";

type ScrollHold = { y: number; at: number; claim: number };

/** Session storage so a remount of this client boundary still sees the tap. */
function readScrollHold(): ScrollHold | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_HOLD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScrollHold>;
    if (typeof parsed.y !== "number" || typeof parsed.at !== "number" || typeof parsed.claim !== "number") return null;
    if (Date.now() - parsed.at > SCROLL_HOLD_TTL_MS) {
      sessionStorage.removeItem(SCROLL_HOLD_KEY);
      return null;
    }
    return { y: parsed.y, at: parsed.at, claim: parsed.claim };
  } catch {
    return null;
  }
}

function writeScrollHold(y: number) {
  try {
    const next: ScrollHold = { y, at: Date.now(), claim: 0 };
    sessionStorage.setItem(SCROLL_HOLD_KEY, JSON.stringify(next));
  } catch {
    // Private mode can reject storage. scroll:false and the stable layout still apply.
  }
}

/** Bump the claim so an unmount of the previous tab does not drop this hold. */
function claimScrollHold(at: number): number | null {
  const current = readScrollHold();
  if (!current || current.at !== at) return null;
  const claim = current.claim + 1;
  try {
    sessionStorage.setItem(SCROLL_HOLD_KEY, JSON.stringify({ ...current, claim } satisfies ScrollHold));
  } catch {
    return null;
  }
  return claim;
}

function clearScrollHold(at: number, claim: number) {
  const current = readScrollHold();
  if (!current || current.at !== at || current.claim !== claim) return;
  try {
    sessionStorage.removeItem(SCROLL_HOLD_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Put the window back on `y`. Clamps when the document is still too short
 * and returns false in that case so the caller keeps trying. Does not
 * scroll when already there, so it does not loop on its own scroll event.
 */
export function restoreWindowScroll(y: number): boolean {
  const max = Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);
  const top = Math.min(Math.max(0, y), max);
  const reached = Math.abs(top - y) <= 1;
  if (Math.abs(window.scrollY - top) <= 1) return reached;
  const previous = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, top);
  document.documentElement.style.scrollBehavior = previous;
  return reached && Math.abs(window.scrollY - y) <= 1;
}

/** "ทั้งหมด | รอตรวจ N" (2026-10-11): the pending review list gets its own tab instead of a box above the list. */
export function ListTabs({ active, pendingCount }: { active: ListTab; pendingCount: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function select(tab: ListTab) {
    if (tab === active) return;
    writeScrollHold(window.scrollY);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "pending") params.set("tab", "pending");
    else params.delete("tab");
    // A day picked on the strip doesn't follow you to the other tab: the
    // review tab showed "nothing" for that one day while 13 waited on others.
    params.delete("from");
    params.delete("to");
    startTransition(() => router.push(`/money/transactions?${params.toString()}`, { scroll: false }));
  }

  // The route update is async. Hold the scroll captured at the tap until
  // the new tab has committed, and for a short window after that in case
  // the router adjusts scroll once the document height changes.
  useLayoutEffect(() => {
    const hold = readScrollHold();
    if (!hold) return;
    const claim = claimScrollHold(hold.at);
    if (claim == null) return;
    const { y, at } = hold;
    let raf = 0;
    const started = performance.now();
    const tick = () => {
      const current = readScrollHold();
      if (!current || current.at !== at || current.claim !== claim) return;
      restoreWindowScroll(y);
      if (performance.now() - started < SCROLL_HOLD_MS) raf = requestAnimationFrame(tick);
      else clearScrollHold(at, claim);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Leaving the page must not replay this offset on the next visit.
  // A remount in the same commit claims the hold before this timer fires.
  useLayoutEffect(() => {
    return () => {
      const hold = readScrollHold();
      if (!hold) return;
      window.setTimeout(() => clearScrollHold(hold.at, hold.claim), 0);
    };
  }, []);

  return (
    <div role="tablist" data-testid="finance-list-tabs" className="flex border-b">
      {(["all", "pending"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => select(tab)}
          className={cn(
            "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-sm transition-colors",
            active === tab ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab === "all" ? t("transactions.tabs.all") : t("transactions.tabs.pending")}
          {tab === "pending" && pendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold text-amber-800 tabular-nums dark:text-amber-300">
              {pendingCount}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
