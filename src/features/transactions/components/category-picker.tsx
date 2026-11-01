"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

import type { Category } from "@/types/database";
import { CategoryIcon } from "@/components/shared/category-icon";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";

interface CategoryPickerProps {
  name: string;
  categories: Category[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  disabled?: boolean;
}

export function CategoryPicker({ name, categories, value, onValueChange, disabled = false }: CategoryPickerProps) {
  const { t, locale } = useTranslation();

  // Categories already come back ordered by `sort_order`, which the seed
  // data sets to a realistic real-world usage frequency (food/transport
  // first, "other" last). Every category is on screen as soon as the
  // picker opens. Chips stay compact so the full expense set fits at 390px.
  const selectedLabel = useMemo(() => {
    const selected = categories.find((c) => c.id === value);
    if (!selected) return null;
    return locale === "th" ? selected.name_th : selected.name_en;
  }, [categories, value, locale]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("transactions.category")}>
        {categories.map((category) => {
          const label = locale === "th" ? category.name_th : category.name_en;
          const selected = category.id === value;
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onValueChange(selected ? null : category.id)}
              className={cn(
                "relative flex items-center gap-1 rounded-full border py-1 pr-2.5 pl-1.5 text-sm leading-5 font-medium transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              <CategoryIcon icon={category.icon} className="-my-1 size-7" />
              {label}
              {selected ? (
                <span
                  data-category-selected-marker=""
                  className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden="true"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selectedLabel ? null : (
        <p className="text-xs text-muted-foreground">{t("transactions.selectCategory")}</p>
      )}
    </div>
  );
}
