"use client";

import { useRef } from "react";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

import { formatFriendlyDate } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";

interface DateFieldProps {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
}

/**
 * Shows a friendly label ("Today" / "Yesterday" / "10 Sep 2026") instead of
 * a raw date input. A single real <input type="date"> still backs it (same
 * `name`, so form submission is unaffected) — it's just rendered invisible
 * and stacked on top of the styled button, so a tap opens the native date
 * picker directly instead of needing extra glue code. No `min`/`max` is
 * set, so any past (or future) date can already be picked — the trailing
 * chevron exists purely so that's visually obvious (this pill previously
 * looked like a static label, not a tappable control, unlike the account
 * picker right next to it which already has one).
 */
export function DateField({ name, value, onValueChange, id }: DateFieldProps) {
  const { t, locale } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const friendly = formatFriendlyDate(value, locale, {
    today: t("transactions.today"),
    yesterday: t("transactions.yesterday"),
  });

  // Reported: worked on mobile, not on desktop. Mobile browsers treat a tap
  // anywhere on <input type="date"> as "open the picker" — desktop Chrome/
  // Edge/Firefox only do that for a click on the input's own tiny built-in
  // calendar-icon glyph, which is invisible here (the whole real input is
  // opacity-0, stretched under the styled pill). showPicker() opens it
  // programmatically regardless of where in the pill was clicked; feature-
  // detected and wrapped in try/catch since older desktop Safari and some
  // browsers don't support it yet — falls back to the native invisible-
  // input click behavior (today's status quo) rather than throwing.
  function openPicker() {
    const el = inputRef.current;
    if (el && "showPicker" in el) {
      try {
        el.showPicker();
      } catch {
        // Not supported, or called outside a direct user gesture — the
        // native input underneath the click still handles it as before.
      }
    }
  }

  return (
    <div className="relative inline-flex" onClick={openPicker}>
      <span
        aria-hidden="true"
        className="pointer-events-none flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-sm font-medium"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        {friendly}
        <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <input
        ref={inputRef}
        id={id}
        type="date"
        name={name}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-label={t("transactions.date")}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
