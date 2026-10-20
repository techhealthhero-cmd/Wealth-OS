import { describe, expect, it } from "vitest";
import { createCaptureDeviceStore, LARGE_TEXT_KEY, UNSURE_KEY, DISMISS_KEY } from "@/lib/capture/capture-device-store";
function fixture() {
  const data = new Map<string, string>();
  const storage = () => ({ getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } });
  return { data, store: (id: string | null) => createCaptureDeviceStore(id, storage) };
}
describe("versioned per-user large-text setting", () => {
  it("defaults off on SSR, with no window or missing identity", () => {
    expect(typeof window).toBe("undefined");
    const store = createCaptureDeviceStore("a");
    expect(store.largeText()).toBe(false); expect(() => store.setLargeText(true)).not.toThrow();
  });
  it("stores only a versioned boolean for the selected user", () => {
    const { store, data } = fixture(); store("a").setLargeText(true);
    expect(store("a").largeText()).toBe(true); expect(store("b").largeText()).toBe(false);
    expect(JSON.parse(data.get(`${LARGE_TEXT_KEY}:a`)!)).toEqual({ version: 1, value: true });
    store("a").setLargeText(false); expect(store("a").largeText()).toBe(false);
  });
  it.each(["{", "null", '{"version":2,"value":true}', '{"version":1,"value":"true"}', "true", '{"version":1}'])("ignores corrupt/unknown data: %s", raw => {
    const { data, store } = fixture(); data.set(`${LARGE_TEXT_KEY}:a`, raw); expect(store("a").largeText()).toBe(false);
  });
  it("does not read or write an anonymous bucket", () => {
    const { data, store } = fixture(); const anonymous = store(null);
    anonymous.setLargeText(true); anonymous.remember("โอนให้น้องเมย์ 1500", "expense"); anonymous.dismiss(100);
    expect(data.size).toBe(0); expect(anonymous.answer("โอนให้น้องเมย์ 1500")).toBeNull();
  });
  it("tolerates denied localStorage and write quota", () => {
    const denied = createCaptureDeviceStore("a", () => { throw new Error("denied"); });
    expect(denied.largeText()).toBe(false); expect(denied.answer("hello")).toBeNull(); expect(() => denied.setLargeText(true)).not.toThrow();
    const quota = createCaptureDeviceStore("a", () => ({ getItem: () => null, setItem: () => { throw new Error("quota"); } }));
    expect(() => quota.remember("โอนให้น้องเมย์ 1500", "lend")).not.toThrow();
  });
  it("encodes identities to avoid key collisions", () => {
    const { store, data } = fixture(); store("a:b").setLargeText(true); expect(data.has(`${LARGE_TEXT_KEY}:a%3Ab`)).toBe(true); expect(store("a%3Ab").largeText()).toBe(false);
  });
});
describe("unsure answer memory", () => {
  it("remembers the same phrase across new amounts, but asks for a different counterpart", () => {
    const { store } = fixture(); store("a").remember("โอนให้น้องเมย์ 1,500", "wage");
    expect(store("a").answer("โอนให้น้องเมย์ 2000 วันนี้")).toBe("wage");
    expect(store("a").answer("โอนให้น้องแนน 1500")).toBeNull();
    expect(store("b").answer("โอนให้น้องเมย์ 1500")).toBeNull();
  });
  it("supports correcting a remembered answer", () => {
    const { store } = fixture(); const repo = store("a"); repo.remember("โอนให้น้องเมย์ 1500", "expense"); repo.remember("โอนให้น้องเมย์ 1500", "lend"); expect(repo.answer("โอนให้น้องเมย์ 100")).toBe("lend");
  });
  it.each(['{"version":2,"value":{"ให้น้องเมย์":"lend"}}', '{"version":1,"value":[]}', '{"version":1,"value":{"ให้น้องเมย์":"hacked"}}', "null", "{"])("ignores corrupt answer memory: %s", raw => {
    const { data, store } = fixture(); data.set(`${UNSURE_KEY}:a`, raw); expect(store("a").answer("โอนให้น้องเมย์ 1500")).toBeNull();
  });
  it("bounds phrase history", () => {
    const { data, store } = fixture(); for (let i = 0; i < 305; i++) store("a").remember(`โอนให้เพื่อน${String.fromCodePoint(0xe01 + Math.floor(i / 40))}${String.fromCodePoint(0xe01 + i % 40)} 10`, "expense");
    expect(Object.keys(JSON.parse(data.get(`${UNSURE_KEY}:a`)!).value).length).toBeLessThanOrEqual(300);
  });
});
describe("suggestion dismissal persistence", () => {
  it("isolates dismissal by user and rejects invalid timestamps", () => {
    const { store, data } = fixture(); store("a").dismiss(1234); expect(store("a").dismissedAt()).toBe(1234); expect(store("b").dismissedAt()).toBeNull();
    data.set(`${DISMISS_KEY}:a`, '{"version":1,"value":-1}'); expect(store("a").dismissedAt()).toBeNull();
    store("a").dismiss(NaN); expect(store("a").dismissedAt()).toBeNull();
  });
});

describe("tab session suggestion marker", () => {
  it("retains count/shown across a reload, with version and identity isolation", async () => {
    const { createCaptureSessionStore } = await import("@/lib/capture/capture-device-store");
    const data = new Map<string, string>();
    const storage = () => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } });
    createCaptureSessionStore("a", storage).save({ count: 3, shown: true });
    expect(createCaptureSessionStore("a", storage).load()).toEqual({ count: 3, shown: true });
    expect(createCaptureSessionStore("b", storage).load()).toEqual({ count: 0, shown: false });
    data.set("wos.captureSuggestionSession.v1:a", '{"version":2,"count":3,"shown":true}');
    expect(createCaptureSessionStore("a", storage).load()).toEqual({ count: 0, shown: false });
  });
  it("starts fresh on SSR or corrupt data", async () => {
    const { createCaptureSessionStore } = await import("@/lib/capture/capture-device-store");
    expect(createCaptureSessionStore("a").load()).toEqual({ count: 0, shown: false });
    expect(createCaptureSessionStore("a", () => ({ getItem: () => "{", setItem: () => {} })).load()).toEqual({ count: 0, shown: false });
  });
  it("never treats inherited object properties as a stored answer", () => {
    const { store } = fixture(); expect(store("a").answer("constructor 50")).toBeNull(); expect(store("a").answer("toString 50")).toBeNull();
  });
});
