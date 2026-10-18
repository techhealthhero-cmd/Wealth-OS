"use client";

import { useSyncExternalStore } from "react";

/**
 * Which flip cards the viewer has turned face-down (tap a card to close it,
 * tap again to open) — one store per kind of card: accounts, assets and
 * liabilities each get their own localStorage key. A per-device display
 * preference only: the amount is still in the page, so this is not a privacy
 * control (the PIN-gated account-privacy feature is). Remembered in
 * localStorage so a closed card stays closed on the next visit; any storage
 * failure just means every card starts open.
 */
export function createClosedCardsStore(storageKey: string) {
  const listeners = new Set<() => void>();
  let cache: string | null = null;

  function read(): string {
    if (cache !== null) return cache;
    try {
      cache = window.localStorage.getItem(storageKey) ?? "[]";
    } catch {
      cache = "[]";
    }
    return cache;
  }

  function closedIds(): string[] {
    try {
      const parsed: unknown = JSON.parse(read());
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function setClosed(id: string, closed: boolean) {
    const ids = new Set(closedIds());
    if (closed) ids.add(id);
    else ids.delete(id);
    cache = JSON.stringify([...ids]);
    try {
      window.localStorage.setItem(storageKey, cache);
    } catch {
      // Still flips for this visit; it just won't be remembered.
    }
    listeners.forEach((listener) => listener());
  }

  /** Open on the server and during hydration, then the remembered state. */
  function useClosed(id: string): boolean {
    return useSyncExternalStore(
      subscribe,
      () => closedIds().includes(id),
      () => false
    );
  }

  return { setClosed, useClosed };
}
