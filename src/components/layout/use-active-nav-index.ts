"use client";

import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

/**
 * Index into `NAV_ITEMS` of whichever tab the current route belongs to, or
 * `-1` if the route doesn't belong to any of them (e.g. `/profile`,
 * `/billing`, `/help` — pages reachable from within the app shell but not
 * one of the 5 primary sections). Shared by BottomNav (which tab to
 * highlight/bump) and PullToRefresh (which tab a horizontal swipe should
 * move to/from) so the two can't drift out of sync on what "active" means.
 */
export function useActiveNavIndex(): number {
  const pathname = usePathname();
  return NAV_ITEMS.findIndex(
    (item) => pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
  );
}
