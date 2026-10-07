"use client";

import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";

/**
 * Index into `NAV_ITEMS` of whichever tab the current route belongs to, or
 * `-1` if the route doesn't belong to any of them (e.g. `/profile`,
 * `/billing`, `/help` — pages reachable from within the app shell but not
 * one of the 5 primary sections). Used by BottomNav to decide which tab to
 * highlight/bump.
 */
export function useActiveNavIndex(): number {
  const pathname = usePathname();
  return NAV_ITEMS.findIndex(
    (item) => pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
  );
}
