"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side plumbing for the living companion (Plus/Pro presence).
 *
 * - `cheerCompanion()` is fired right after a money save succeeds
 *   (transaction / transfer / quick capture) so the companion can react —
 *   a plain window event, so the forms don't need to know the companion
 *   exists.
 * - The on/off preference is per device (localStorage), same nature as the
 *   floating button's own idle-opacity setting: it's about how this screen
 *   behaves, not account data. Defaults to on.
 */
export const COMPANION_CHEER_EVENT = "wealth-os:companion-cheer";

export function cheerCompanion() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMPANION_CHEER_EVENT));
}

const PRESENCE_KEY = "wealth-os:companion-presence";
const PRESENCE_EVENT = "wealth-os:companion-presence-change";
let memoryValue: boolean | null = null;

function read(): boolean {
  if (memoryValue !== null) return memoryValue;
  try {
    return localStorage.getItem(PRESENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setCompanionPresenceEnabled(enabled: boolean) {
  memoryValue = enabled;
  try {
    localStorage.setItem(PRESENCE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage unavailable — still applies for this page view via memoryValue.
  }
  window.dispatchEvent(new Event(PRESENCE_EVENT));
}

function subscribe(onChange: () => void) {
  function handleStorage(e: StorageEvent) {
    if (e.key === PRESENCE_KEY) {
      memoryValue = null;
      onChange();
    }
  }
  window.addEventListener(PRESENCE_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PRESENCE_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useCompanionPresenceEnabled(): boolean {
  return useSyncExternalStore(subscribe, read, () => true);
}

/** True when at least `intervalMs` has passed since `key` was last stamped (or never stamped). */
export function isDue(key: string, intervalMs: number): boolean {
  try {
    const last = Number(localStorage.getItem(key) ?? 0);
    return !Number.isFinite(last) || Date.now() - last >= intervalMs;
  } catch {
    return false;
  }
}

export function stamp(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Without storage we simply may check again next load — harmless.
  }
}
