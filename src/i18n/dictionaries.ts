import "server-only";

import th from "./locales/th.json";
import en from "./locales/en.json";
import type { Locale } from "./config";

const dictionaries = { th, en } satisfies Record<Locale, typeof th>;

export type Dictionary = typeof th;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
