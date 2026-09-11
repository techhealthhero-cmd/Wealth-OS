"use client";

import { useMemo, useState } from "react";

import type { Category } from "@/types/database";
import { categoryEmoji } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

const COLLAPSED_COUNT = 8;

interface CategoryPickerProps {
  name: string;
  categories: Category[];
  value: string | null;
  onValueChange: (id: string | null) => void;
}

export function CategoryPicker({ name, categories, value, onValueChange }: CategoryPickerProps) {
  const { t, locale } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Categories already come back ordered by `sort_order`, which the seed
  // data sets to a realistic real-world usage frequency (food/transport
  // first, "other" last) — a reasonable proxy for "frequently used first"
  // without needing a separate per-user usage query.
  const visible = expanded ? categories : categories.slice(0, COLLAPSED_COUNT);
  const canExpand = categories.length > COLLAPSED_COUNT;

  const selectedLabel = useMemo(() => {
    const selected = categories.find((c) => c.id === value);
    if (!selected) return null;
    return locale === "th" ? selected.name_th : selected.name_en;
  }, [categories, value, locale]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("transactions.category")}>
        {visible.map((category) => {
          const label = locale === "th" ? category.name_th : category.name_en;
          const selected = category.id === value;
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onValueChange(selected ? null : category.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all active:scale-95",
                selected
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              <span aria-hidden="true">{categoryEmoji(category.icon)}</span>
              {label}
            </button>
          );
        })}
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            {expanded ? t("transactions.showFewerCategories") : t("transactions.viewAllCategories")}
          </button>
        )}
      </div>
      {selectedLabel ? null : (
        <p className="text-xs text-muted-foreground">{t("transactions.selectCategory")}</p>
      )}
    </div>
  );
}
