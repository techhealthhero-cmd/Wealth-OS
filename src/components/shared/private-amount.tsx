"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "wealthos:hide-amounts";

interface PrivateAmountProps {
  value: number;
  formatAs: "money" | "percent1" | "integer";
  currencyCode?: string;
  className?: string;
  /** Matches AnimatedNumber's tone against a dark "highlight" hero card vs. the default light card. */
  toggleTone?: "default" | "on-dark";
}

/**
 * Wraps AnimatedNumber with a tap-to-hide privacy toggle — for glancing at
 * net worth in public without the amount being visible over someone's
 * shoulder. Preference persists per-browser via localStorage (never sent
 * anywhere, purely a per-viewer convenience) so it stays hidden across
 * navigations once set, rather than resetting on every page load.
 */
export function PrivateAmount({ value, formatAs, currencyCode, className, toggleTone = "default" }: PrivateAmountProps) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);

  // localStorage is a browser API unavailable during the server render pass;
  // reading it here, after mount, is the correct place to hydrate from it.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Private browsing / blocked storage — falls back to always-visible, which is safe.
    }
  }, []);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Nothing to do if storage is unavailable — the toggle still works for this render.
      }
      return next;
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {hidden ? (
        <span className={className} aria-label={t("netWorth.amountHidden")}>
          ••••••
        </span>
      ) : (
        <AnimatedNumber value={value} formatAs={formatAs} currencyCode={currencyCode} className={className} />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={hidden ? t("netWorth.showAmount") : t("netWorth.hideAmount")}
        className={
          toggleTone === "on-dark"
            ? "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            : undefined
        }
      >
        {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </span>
  );
}
