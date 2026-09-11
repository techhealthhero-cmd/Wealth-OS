"use client";

import * as React from "react";

import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  dict: Dictionary;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: I18nContextValue & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function getNested(obj: unknown, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Client-side translation hook. `key` uses dot notation, e.g. "dashboard.title".
 * Falls back to the raw key (visibly, on purpose) if a translation is missing,
 * so untranslated strings are obvious in development rather than blank.
 */
export function useTranslation() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }

  const t = React.useCallback(
    (key: string) => getNested(ctx.dict, key.split(".")) ?? key,
    [ctx.dict]
  );

  return { t, locale: ctx.locale };
}
