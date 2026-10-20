import { ArrowDown, Car, Ellipsis, House, ShoppingBag, Utensils } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SlipCategoryIcon } from "./types";

const ICONS = {
  food: Utensils,
  go: Car,
  home: House,
  shop: ShoppingBag,
  other: Ellipsis,
  income: ArrowDown,
} as const;

/** Line icon inside a soft circle — no boxed image backgrounds. */
export function CategoryIcon({
  icon,
  className,
  tone = "default",
}: {
  icon: SlipCategoryIcon;
  className?: string;
  tone?: "default" | "income" | "gold";
}) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full",
        tone === "income"
          ? "bg-[#2f8a5b]/15 text-[#2f8a5b]"
          : tone === "gold"
            ? "bg-[#c9a15a]/20 text-[#8a6a28]"
            : "bg-[#204d3d]/10 text-[#204d3d]",
        className
      )}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </span>
  );
}
