import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * iOS can re-prompt for the microphone for every new SpeechRecognition
 * object. The browser provider must therefore create ONE recognizer and
 * reuse it across starts and hold-to-talk restarts, and events from an old
 * session must never leak into a new one.
 */
class FakeRecognition {
  static created = 0;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  running = false;
  constructor() {
    FakeRecognition.created += 1;
  }
  start() {
    if (this.running) throw new Error("InvalidStateError");
    this.running = true;
  }
  stop() {
    this.end();
  }
  abort() {
    this.end();
  }
  end() {
    this.running = false;
    this.onend?.();
  }
  hear(text: string) {
    this.onresult?.({ results: [Object.assign([{ transcript: text }], { isFinal: true })] });
  }
}

let last: FakeRecognition | null = null;

beforeEach(() => {
  vi.resetModules();
  FakeRecognition.created = 0;
  const Tracked = class extends FakeRecognition {
    constructor() {
      super();
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      last = this;
    }
  };
  vi.stubGlobal("window", { webkitSpeechRecognition: Tracked, localStorage: { setItem: () => {}, getItem: () => null } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser speech provider — one recognizer per page", () => {
  it("reuses the same recognizer for every start, including restarts", async () => {
    const { browserSpeechProvider } = await import("@/lib/speech/use-speech-input");
    const heard: string[] = [];
    for (let i = 0; i < 5; i++) {
      const session = browserSpeechProvider.start({
        lang: "th-TH",
        continuous: true,
        onTranscript: (t) => heard.push(t),
        onEnd: () => {},
        onError: () => {},
      });
      last!.hear(`item ${i}`);
      session.stop();
    }
    expect(FakeRecognition.created).toBe(1);
    expect(heard).toEqual(["item 0", "item 1", "item 2", "item 3", "item 4"]);
  });

  it("starting while a session is still running ends the old one silently", async () => {
    const { browserSpeechProvider } = await import("@/lib/speech/use-speech-input");
    const oldEnd = vi.fn();
    const oldHeard = vi.fn();
    browserSpeechProvider.start({ lang: "th-TH", onTranscript: oldHeard, onEnd: oldEnd, onError: () => {} });
    const newHeard = vi.fn();
    browserSpeechProvider.start({ lang: "th-TH", onTranscript: newHeard, onEnd: () => {}, onError: () => {} });

    last!.hear("ข้าว 40");
    expect(FakeRecognition.created).toBe(1);
    expect(oldEnd).not.toHaveBeenCalled();
    expect(oldHeard).not.toHaveBeenCalled();
    expect(newHeard).toHaveBeenCalledWith("ข้าว 40", true);
  });
});
