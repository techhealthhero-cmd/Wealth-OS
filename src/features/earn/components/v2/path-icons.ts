import { Briefcase, Laptop, Store, TrendingUp, type LucideIcon } from "lucide-react";

import type { IncomePathType } from "@/lib/earn/types";

/** Shared by server and client components (hub-cards re-exports its own copy for server use). */
export const PATH_ICON_COMPONENTS: Record<IncomePathType, LucideIcon> = {
  career: Briefcase,
  freelance_service: Laptop,
  business_product: Store,
  investment: TrendingUp,
};
