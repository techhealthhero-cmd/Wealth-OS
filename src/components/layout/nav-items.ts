import { Home, Wallet, Target, TrendingUp, Sparkles, type LucideIcon } from "lucide-react";

import { FEATURES } from "@/config/features";

export interface NavItem {
  key: "home" | "money" | "plan" | "earn" | "ai";
  href: string;
  /**
   * Section prefix used only for active-tab highlighting — kept separate
   * from `href` because `href` points directly at the section's default
   * leaf route (e.g. "/money/transactions") to skip the section root's own
   * `redirect()` hop (perf/nav audit finding: tapping "Money"/"Plan"
   * previously always cost an extra server redirect round-trip before the
   * real page rendered, which read to users as an unexpected bounce). The
   * tab must still highlight as active on every route under that section
   * (e.g. "/money/accounts"), not just the one leaf `href` points to.
   */
  matchPrefix: string;
  icon: LucideIcon;
  enabled: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/dashboard", matchPrefix: "/dashboard", icon: Home, enabled: true },
  { key: "money", href: "/money/transactions", matchPrefix: "/money", icon: Wallet, enabled: true },
  { key: "plan", href: "/plan/goals", matchPrefix: "/plan", icon: Target, enabled: FEATURES.plan },
  { key: "earn", href: "/earn", matchPrefix: "/earn", icon: TrendingUp, enabled: FEATURES.earn },
  { key: "ai", href: "/ai", matchPrefix: "/ai", icon: Sparkles, enabled: FEATURES.ai },
];

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => item.enabled);
