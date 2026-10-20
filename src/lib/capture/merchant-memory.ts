import { findSpokenDateMention } from "./capture-date";
/** Device-only observations. No storage access occurs until a repository method is called. */
export type Direction = "income" | "expense";
export interface MemoryVote { categoryId: string; direction: Direction; count: number; weight: number }
export interface MerchantMemoryEntry { key: string; counts: MemoryVote[]; lastUsed: number; source: "correction" | "confirm"; revision?: string; lastCorrection?: { categoryId: string; direction: Direction; at: number } }
export interface MemoryObservation { text: string; categoryId: string; direction: Direction; source: MerchantMemoryEntry["source"] }
export const MEMORY_KEY = "wos.captureMemory.v1";
export const MEMORY_CAP = 300;
export function normalizeMemoryText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\b7(?:-?eleven|-11)\b/g, "เซเว่น").replace(/\s+/g, " ").trim();
}
const STOP = /เงินสด|บัตรเครดิต|เมื่อกี้|มะรืน|อาทิตย์ก่อน|สัปดาห์ก่อน|เดือนก่อน|วันก่อน|เมื่อวานซืน|เมื่อวาน|วันนี้|พรุ่งนี้|จ่าย|ซื้อ|ได้รับ|โอน|ครับ|ค่ะ|\b(?:paid|buy|bought|received|today|yesterday|tomorrow|last week|last month|cash|thb|baht)\b/gi;
const NUMBER_WORD = "(?:หมื่น|พัน|แสน|ล้าน|ร้อย|สิบ|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|ศูนย์|ยี่|เอ็ด)";
// A number word alone can be an item/brand. Require an amount neighbour.
const AMOUNT = new RegExp(`(?:(?:${NUMBER_WORD}\\s*)+(?=[0-9๐-๙])|[0-9๐-๙.,]+\\s*(?:${NUMBER_WORD}\\s*)*(?:บาท|฿|k)?|(?:${NUMBER_WORD}\\s*){2,}(?:บาท|฿|k)?|${NUMBER_WORD}\\s*(?:บาท|฿|k)|฿\\s*(?:${NUMBER_WORD}\\s*)+)`, "gi");
const SHORT_STOP = /(^|[\s|])(?:มา|ไป|ให้|ที่|ได้|ค่า|เงิน)(?=$|[\s|])/g;
export function extractMemoryKey(text: string): string | null {
  let working = normalizeMemoryText(text);
  // Only the span matters here; the fixed reference avoids clock-dependent keys.
  let date = findSpokenDateMention(working, "2000-01-01");
  while (date) {
    working = working.slice(0, date.start) + "|" + working.slice(date.end);
    date = findSpokenDateMention(working, "2000-01-01");
  }
  // Keep contiguous context: joining across a removed amount/account creates keys
  // that cannot be substrings of the next sentence ("shop 100 cash" → "shop cash").
  const candidates = working.replace(/\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?/g, "|")
    .replace(AMOUNT, "|").replace(/[฿$€£]+/g, "|").replace(/บาท/g, "|").replace(STOP, "|")
    .replace(SHORT_STOP, "$1|").replace(SHORT_STOP, "$1|")
    .replace(/[^\p{L}\p{M}\s|-]/gu, "|").split("|")
    .map(key => key.replace(/\s+/g, " ").trim()).filter(validKey);
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}
function validKey(key: string): boolean {
  return key.length <= 120 && ((/[ก-ฮ]/.test(key) && (key.match(/[ก-ฮะาำิีึืุูเแโใไๅ]/g)?.length ?? 0) >= 3) || (key.match(/[a-z]/g)?.length ?? 0) >= 3);
}
export function lookupMemory(text: string, entries: MerchantMemoryEntry[]) {
  const normalized = normalizeMemoryText(text);
  const entry = entries.filter(e => normalized.includes(e.key)).sort((a, b) => b.key.length - a.key.length)[0];
  if (!entry) return null;
  const votes = [...entry.counts].sort((a, b) => b.weight - a.weight);
  const total = votes.reduce((n, v) => n + v.weight, 0);
  const winner = votes[0];
  return { ...winner, key: entry.key, reliable: winner.weight / total >= 0.75 && (!votes[1] || winner.weight >= votes[1].weight * 3) };
}
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
function browserStorage(): StorageLike | null { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } }
function validEntry(e: MerchantMemoryEntry): boolean {
  return !!e && typeof e.key === "string" && extractMemoryKey(e.key) === e.key && Number.isFinite(e.lastUsed) &&
    (e.revision === undefined || typeof e.revision === "string") &&
    (e.lastCorrection === undefined || (!!e.lastCorrection && typeof e.lastCorrection.categoryId === "string" && ["income", "expense"].includes(e.lastCorrection.direction) && Number.isFinite(e.lastCorrection.at))) &&
    ["correction", "confirm"].includes(e.source) && Array.isArray(e.counts) && e.counts.length > 0 && e.counts.length <= 100 && e.counts.every(v => typeof v.categoryId === "string" && v.categoryId.length > 0 && ["income", "expense"].includes(v.direction) && Number.isSafeInteger(v.count) && v.count > 0 && Number.isSafeInteger(v.weight) && v.weight > 0);
}
export function createMerchantMemory(userId: string | null, storage: () => StorageLike | null = browserStorage, now = Date.now) {
  // No anonymous shared bucket: a missing identity always fails closed.
  const scopedKey = userId ? `${MEMORY_KEY}:${encodeURIComponent(userId)}` : null;
  const load = (): MerchantMemoryEntry[] => {
    try {
      if (!scopedKey) return [];
      const raw = storage()?.getItem(scopedKey);
      if (!raw || raw.length > 2_000_000) return [];
      const data = JSON.parse(raw);
      return data.version === 1 && Array.isArray(data.entries) ? data.entries.filter(validEntry).slice(0, MEMORY_CAP) : [];
    } catch { return []; }
  };
  const write = (entries: MerchantMemoryEntry[]) => { try { if (scopedKey) storage()?.setItem(scopedKey, JSON.stringify({ version: 1, entries })); } catch { /* Quota/private mode must never break saving. */ } };
  return {
    load,
    learn(observation: MemoryObservation) {
      const key = extractMemoryKey(observation.text);
      if (!scopedKey || !key || !observation.categoryId || !["income", "expense"].includes(observation.direction) || !["confirm", "correction"].includes(observation.source)) return null;
      const entries = load();
      const entry = entries.find(e => e.key === key) ?? { key, counts: [], lastUsed: now(), source: observation.source };
      const vote = entry.counts.find(v => v.categoryId === observation.categoryId && v.direction === observation.direction);
      const weight = observation.source === "correction" ? 3 : 1;
      const correction = entry.lastCorrection;
      const alternating = correction && now() >= correction.at && now() - correction.at <= 10 * 60_000 &&
        (correction.categoryId !== observation.categoryId || correction.direction !== observation.direction);
      if (observation.source === "correction") {
        for (const competitor of entry.counts) if (competitor !== vote) competitor.weight = 1;
      }
      if (vote) { vote.count++; vote.weight += weight; }
      else entry.counts.push({ categoryId: observation.categoryId, direction: observation.direction, count: 1, weight });
      if (observation.source === "correction") {
        const corrected = entry.counts.find(v => v.categoryId === observation.categoryId && v.direction === observation.direction)!;
        const competitors = entry.counts.filter(v => v !== corrected);
        corrected.weight = Math.max(corrected.weight, 3 * competitors.reduce((sum, v) => sum + v.weight, 0));
        if (alternating && competitors.length) competitors[0].weight = corrected.weight;
        entry.lastCorrection = { categoryId: observation.categoryId, direction: observation.direction, at: now() };
      }
      entry.revision = globalThis.crypto.randomUUID();
      entry.lastUsed = now(); entry.source = observation.source;
      write([entry, ...entries.filter(e => e.key !== key)].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MEMORY_CAP));
      return key;
    },
    lookup: (text: string) => lookupMemory(text, load()),
    forget(key: string) { write(load().filter(e => e.key !== key)); },
    clear() { try { if (scopedKey) storage()?.removeItem(scopedKey); } catch { /* unavailable */ } },
    /** Snapshot undo is conditional on this exact write still being present. */
    learnWithUndo(observation: MemoryObservation): () => void {
      const key = extractMemoryKey(observation.text);
      const previous = load().find(e => e.key === key);
      const learned = this.learn(observation);
      const saved = load().find(e => e.key === learned);
      let undone = false;
      return () => {
        if (undone || !saved) return;
        undone = true;
        const entries = load();
        const current = entries.find(e => e.key === learned);
        if (!current || current.revision !== saved.revision) return;
        write(entries.flatMap(e => e.key === learned ? (previous ? [previous] : []) : [e]));
      };
    },
  };
}
