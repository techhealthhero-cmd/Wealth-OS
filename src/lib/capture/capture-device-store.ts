import { extractMemoryKey } from "./merchant-memory";

export interface DeviceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type UnsureAnswer = "expense" | "lend" | "wage";
export const LARGE_TEXT_KEY = "wos.captureLargeText.v1";
export const UNSURE_KEY = "wos.captureUnsure.v1";
export const DISMISS_KEY = "wos.captureSuggestion.v1";
export function captureBrowserStorage(): DeviceStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
/** Exact normalized phrase/counterpart, independent of amount/date. Never a shared anonymous bucket. */
export function unsurePhraseKey(text: string): string | null { return extractMemoryKey(text); }
export function createCaptureDeviceStore(userId: string | null, storage: () => DeviceStorage | null = captureBrowserStorage) {
  const key = (prefix: string) => userId ? `${prefix}:${encodeURIComponent(userId)}` : null;
  const read = (prefix: string): unknown => {
    try {
      const scoped = key(prefix);
      const raw = scoped ? storage()?.getItem(scoped) : null;
      if (!raw || raw.length > 100_000) return null;
      const data = JSON.parse(raw);
      return data?.version === 1 ? data.value : null;
    } catch { return null; }
  };
  const write = (prefix: string, value: unknown) => {
    try { const scoped = key(prefix); if (scoped) storage()?.setItem(scoped, JSON.stringify({ version: 1, value })); } catch { /* Private mode/quota must not break capture. */ }
  };
  const answers = (): Record<string, UnsureAnswer> => {
    const value = read(UNSURE_KEY);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([phrase, answer]) => phrase.length > 0 && phrase.length <= 120 && ["expense", "lend", "wage"].includes(answer)).slice(-300));
  };
  return {
    largeText: () => read(LARGE_TEXT_KEY) === true,
    setLargeText: (enabled: boolean) => write(LARGE_TEXT_KEY, enabled),
    dismissedAt: () => { const n = read(DISMISS_KEY); return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null; },
    dismiss: (now: number) => { if (Number.isFinite(now) && now >= 0) write(DISMISS_KEY, now); },
    answer: (text: string): UnsureAnswer | null => { const phrase = unsurePhraseKey(text); const known = answers(); return phrase && Object.hasOwn(known, phrase) ? known[phrase] : null; },
    remember: (text: string, answer: UnsureAnswer) => {
      const phrase = unsurePhraseKey(text);
      if (!phrase || !["expense", "lend", "wage"].includes(answer)) return;
      const next = answers(); delete next[phrase];
      write(UNSURE_KEY, Object.fromEntries([...Object.entries(next), [phrase, answer]].slice(-300)));
    },
  };
}

/** Tab-scoped effort/shown marker survives reloads but never a new tab session. */
export function createCaptureSessionStore(userId: string | null, storage: () => DeviceStorage | null = () => {
  try { return typeof window === "undefined" ? null : window.sessionStorage; } catch { return null; }
}) {
  const key = userId ? `wos.captureSuggestionSession.v1:${encodeURIComponent(userId)}` : null;
  return {
    load(): { count: number; shown: boolean } {
      try {
        const raw = key ? storage()?.getItem(key) : null;
        const data = raw && raw.length < 1000 ? JSON.parse(raw) : null;
        if (data?.version === 1 && Number.isInteger(data.count) && data.count >= 0 && data.count <= 3 && typeof data.shown === "boolean") return { count: data.count, shown: data.shown };
      } catch { /* SSR/private mode starts a fresh in-memory session. */ }
      return { count: 0, shown: false };
    },
    save(session: { count: number; shown: boolean }) {
      try { if (key) storage()?.setItem(key, JSON.stringify({ version: 1, ...session })); } catch { /* In-memory fallback remains available. */ }
    },
  };
}
