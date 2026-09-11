"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

const QUICK_AMOUNTS = [50, 100, 200, 500];

function sanitizeAmountInput(raw: string): string {
  // Digits and at most one decimal point, at most 2 decimal places. Negative
  // signs are stripped outright — Step 2 requires no negative amount entry.
  let value = raw.replace(/[^0-9.]/g, "");
  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "");
  }
  const [whole, fraction] = value.split(".");
  if (fraction !== undefined && fraction.length > 2) {
    value = `${whole}.${fraction.slice(0, 2)}`;
  }
  return value;
}

interface AmountInputProps {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  currencySymbol?: string;
  autoFocus?: boolean;
  "aria-label": string;
}

export function AmountInput({
  name,
  value,
  onValueChange,
  currencySymbol = "฿",
  autoFocus,
  "aria-label": ariaLabel,
}: AmountInputProps) {
  const chipsLabelId = useId();
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-muted/50 px-3 py-6">
        <span className="shrink-0 text-2xl font-semibold text-muted-foreground sm:text-3xl" aria-hidden="true">
          {currencySymbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          name={name}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          placeholder="0"
          value={value}
          onChange={(e) => onValueChange(sanitizeAmountInput(e.target.value))}
          size={Math.max(1, value.length || 1)}
          className="min-w-0 max-w-full border-0 bg-transparent text-center text-4xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-5xl"
        />
      </div>

      <div className="flex justify-center gap-2" role="group" aria-labelledby={chipsLabelId}>
        <span id={chipsLabelId} className="sr-only">
          {t("transactions.quickAmounts")}
        </span>
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onValueChange(String(amount))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              value === String(amount)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
          >
            {currencySymbol}
            {amount}
          </button>
        ))}
      </div>
    </div>
  );
}
