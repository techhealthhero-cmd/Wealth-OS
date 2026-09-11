import { Home, Wallet, Target, TrendingUp, Sparkles, type LucideIcon } from "lucide-react";

import { FEATURES } from "@/config/features";

export interface NavItem {
  key: "home" | "money" | "plan" | "earn" | "ai";
  href: string;
  icon: LucideIcon;
  enabled: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/dashboard", icon: Home, enabled: true },
  { key: "money", href: "/money", icon: Wallet, enabled: true },
  { key: "plan", href: "/plan", icon: Target, enabled: FEATURES.plan },
  { key: "earn", href: "/earn", icon: TrendingUp, enabled: FEATURES.earn },
  { key: "ai", href: "/ai", icon: Sparkles, enabled: FEATURES.ai },
];

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => item.enabled);
