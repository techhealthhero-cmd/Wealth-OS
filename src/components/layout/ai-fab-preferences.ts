"use client";

import { useSyncExternalStore } from "react";

/**
 * Per-device preference for the floating AI button's "idle opacity" —
 * modeled on iOS AssistiveTouch's "Idle Opacity" setting: after a few
 * seconds untouched the button fades to this level, and returns to fully
 * opaque the moment it's touched (see FloatingAiButton).
 *
 * Stored in localStorage alongside the button's own position (same
 * per-device nature — it's about how this screen looks, not account data),
 * and broadcast via a custom event so the Settings slider updates the live
 * button on the same page immediately.
 */
const STORAGE_KEY = "wealth-os:ai-fab-idle-opacity";
const CHANGE_EVENT = "wealth-os:ai-fab-idle-opacity-change";

export const AI_FAB_IDLE_OPACITY_MIN = 15;
export const AI_FAB_IDLE_OPACITY_MAX = 100;
// Requested: match iPhone AssistiveTouch's own default (40%) out of the box.
// Applies to anyone who hasn't moved the slider yet (nothing stored); a
// value a user already chose is kept as-is.
export const AI_FAB_IDLE_OPACITY_DEFAULT = 40;

export function clampIdleOpacity(value: number): number {
  if (!Number.isFinite(value)) return AI_FAB_IDLE_OPACITY_DEFAULT;
  return Math.min(AI_FAB_IDLE_OPACITY_MAX, Math.max(AI_FAB_IDLE_OPACITY_MIN, Math.round(value)));
}

function readIdleOpacity(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return AI_FAB_IDLE_OPACITY_DEFAULT;
    return clampIdleOpacity(Number(raw));
  } catch {
    return AI_FAB_IDLE_OPACITY_DEFAULT;
  }
}

export function setAiFabIdleOpacity(value: number) {
  const clamped = clampIdleOpacity(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {
    // Storage unavailable — the change still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: clamped }));
}

let memoryValue: number | null = null;

function subscribe(onChange: () => void) {
  function handleCustom(e: Event) {
    memoryValue = (e as CustomEvent<number>).detail;
    onChange();
  }
  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) {
      memoryValue = null;
      onChange();
    }
  }
  window.addEventListener(CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): number {
  // memoryValue covers the private-mode case where the write to storage
  // failed but the slider should still move the live button.
  return memoryValue ?? readIdleOpacity();
}

export function useAiFabIdleOpacity(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => AI_FAB_IDLE_OPACITY_DEFAULT);
}

/**
 * Show/hide the floating AI button entirely (Settings toggle). Same
 * per-device storage + live-broadcast pattern as idle opacity above. Hiding
 * it never removes AI access — /ai stays reachable from the desktop sidebar
 * and the Settings card's own link.
 */
const ENABLED_STORAGE_KEY = "wealth-os:ai-fab-enabled";
const ENABLED_CHANGE_EVENT = "wealth-os:ai-fab-enabled-change";
let enabledMemoryValue: boolean | null = null;

export function parseEnabled(raw: string | null): boolean {
  // Anything other than an explicit "false" (incl. nothing stored) = shown,
  // so the button stays on by default for new and existing users.
  return raw !== "false";
}

function readEnabled(): boolean {
  try {
    return parseEnabled(localStorage.getItem(ENABLED_STORAGE_KEY));
  } catch {
    return true;
  }
}

export function setAiFabEnabled(enabled: boolean) {
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Storage unavailable — still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(ENABLED_CHANGE_EVENT, { detail: enabled }));
}

function subscribeEnabled(onChange: () => void) {
  function handleCustom(e: Event) {
    enabledMemoryValue = (e as CustomEvent<boolean>).detail;
    onChange();
  }
  function handleStorage(e: StorageEvent) {
    if (e.key === ENABLED_STORAGE_KEY) {
      enabledMemoryValue = null;
      onChange();
    }
  }
  window.addEventListener(ENABLED_CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(ENABLED_CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useAiFabEnabled(): boolean {
  return useSyncExternalStore(subscribeEnabled, () => enabledMemoryValue ?? readEnabled(), () => true);
}
