import { describe, expect, it } from "vitest";
import { captureLayout, countCaptureEffort, shouldSuggestLargeText, SUGGESTION_DELAY } from "@/lib/capture/capture-display";

describe("capture A/B viewport decision", () => {
  it.each([undefined, null])("defaults to A without visualViewport or on SSR (%s)", viewport => expect(captureLayout(viewport)).toBe("a"));
  it.each([844, 800, 694])("keeps A for full height or toolbar jitter: %s", height => expect(captureLayout({ layoutHeight: 844, height, offsetTop: 0 })).toBe("a"));
  it.each([693, 554, 400])("switches B above 150px shrink: %s", height => expect(captureLayout({ layoutHeight: 844, height, offsetTop: 0 })).toBe("b"));
  it("keeps B when iOS pans the viewport above the keyboard", () => expect(captureLayout({ layoutHeight: 844, height: 500, offsetTop: 170 })).toBe("b"));
  it("does not mistake pinch zoom for a keyboard", () => expect(captureLayout({ layoutHeight: 844, height: 420, offsetTop: 0, scale: 2 })).toBe("a"));
  it.each([0, -1, NaN, Infinity])("fails closed on invalid viewport height %s", height => expect(captureLayout({ layoutHeight: 844, height, offsetTop: 0 })).toBe("a"));
});
describe("large-text suggestion policy", () => {
  const now = 2_000_000_000_000;
  it("counts three efforts without mutating input or overflowing", () => {
    const initial = { count: 0, shown: false };
    const one = countCaptureEffort(initial); const two = countCaptureEffort(one); const three = countCaptureEffort(two);
    expect(initial.count).toBe(0);
    expect(shouldSuggestLargeText(one, false, null, now)).toBe(false);
    expect(shouldSuggestLargeText(two, false, null, now)).toBe(false);
    expect(shouldSuggestLargeText(three, false, null, now)).toBe(true);
    expect(countCaptureEffort(three).count).toBe(3);
  });
  it("shows only once per session even after the dismissal delay", () => expect(shouldSuggestLargeText({ count: 3, shown: true }, false, now - SUGGESTION_DELAY, now)).toBe(false));
  it("never suggests while large text is enabled", () => expect(shouldSuggestLargeText({ count: 3, shown: false }, true, null, now)).toBe(false));
  it("waits the full 14 days, then permits a fresh session", () => {
    const session = { count: 3, shown: false };
    expect(shouldSuggestLargeText(session, false, now - SUGGESTION_DELAY + 1, now)).toBe(false);
    expect(shouldSuggestLargeText(session, false, now - SUGGESTION_DELAY, now)).toBe(true);
    expect(shouldSuggestLargeText(session, false, now + 1, now)).toBe(false);
  });
});
