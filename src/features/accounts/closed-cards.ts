"use client";

import { useSyncExternalStore } from "react";

/**
 * Which account cards the viewer has flipped face-down (tap a card to close
 * it, tap again to open). A per-device display preference only: the balance
 * is still in the page, so this is not a privacy control (account-privacy
 * is). Remembered in localStorage so a closed
 * card stays closed on the next visit; any storage failure just means every
 * card starts open.
 */
const STORAGE_KEY = "wealthos.closedAccountCards";
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  if (cache !== null) return cache;
  try {
    cache = window.localStorage.getItem(STORAGE_KEY) ?? "[]";
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

export function setAccountCardClosed(accountId: string, closed: boolean) {
  const ids = new Set(closedIds());
  if (closed) ids.add(accountId);
  else ids.delete(accountId);
  cache = JSON.stringify([...ids]);
  try {
    window.localStorage.setItem(STORAGE_KEY, cache);
  } catch {
    // Still flips for this visit; it just won't be remembered.
  }
  listeners.forEach((listener) => listener());
}

/** Open on the server and during hydration, then the remembered state. */
export function useAccountCardClosed(accountId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => closedIds().includes(accountId),
    () => false
  );
}
