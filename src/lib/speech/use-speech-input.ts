"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Speech-to-text abstraction shared by the AI chat mic and Quick Capture.
 * Components only use `useSpeechInput`; which recognizer runs behind it is
 * a provider choice, so a server-side STT service (e.g. Whisper) can be
 * added later as one more `SpeechProvider` without touching any UI.
 */
export interface SpeechSession {
  stop(): void;
}

export interface SpeechProvider {
  readonly name: string;
  isSupported(): boolean;
  start(options: {
    lang: string;
    /** Keep listening across pauses (hold-to-talk recaps). */
    continuous?: boolean;
    /** Called with the full transcript so far (interim results included). */
    onTranscript: (text: string, isFinal: boolean) => void;
    onEnd: () => void;
    onError: (error: string) => void;
  }): SpeechSession;
}

// Minimal shape of the Web Speech API recognizer — not in TS's DOM lib, and
// only exposed as `webkitSpeechRecognition` on Safari/Chrome.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Set once the user has actually granted the mic and been heard — lets the UI offer the "always allow" tip. */
export const MIC_USED_KEY = "wos.mic.used";

// ONE recognizer for the page's lifetime. iOS Safari can show the
// microphone prompt again for every new SpeechRecognition object, and
// hold-to-talk restarts recognition after each pause — so a fresh object
// per start meant a prompt per pause. Reusing one keeps it to (at most)
// one prompt per app session.
let sharedRecognizer: SpeechRecognitionLike | null = null;
let recognizerBusy = false;
let sessionGeneration = 0;

/** On-device/browser recognition (Safari, Chrome). Nothing is sent to our servers. */
export const browserSpeechProvider: SpeechProvider = {
  name: "browser",
  isSupported: () => getSpeechRecognitionCtor() !== null,
  start({ lang, continuous = false, onTranscript, onEnd, onError }) {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError("unsupported");
      onEnd();
      return { stop() {} };
    }
    sharedRecognizer ??= new Ctor();
    const recognition = sharedRecognizer;
    // Events from an older session must never reach this one's callbacks.
    const generation = ++sessionGeneration;
    const current = () => generation === sessionGeneration;

    const begin = () => {
      if (!current()) return;
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = continuous;
      recognition.onresult = (event) => {
        if (!current()) return;
        const results = Array.from(event.results);
        const text = results.map((r) => r[0]?.transcript ?? "").join("");
        try {
          window.localStorage.setItem(MIC_USED_KEY, "1");
        } catch {
          // Private mode etc. — the tip is optional.
        }
        onTranscript(text, results.every((r) => r.isFinal !== false));
      };
      recognition.onerror = (event) => {
        if (current()) onError(event?.error ?? "error");
      };
      recognition.onend = () => {
        recognizerBusy = false;
        if (current()) onEnd();
      };
      try {
        recognition.start();
        recognizerBusy = true;
      } catch {
        recognizerBusy = false;
        onError("start-failed");
        onEnd();
      }
    };

    if (recognizerBusy) {
      // Still finishing a previous session: stop it quietly, then start.
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = () => {
        recognizerBusy = false;
        begin();
      };
      recognition.abort();
    } else {
      begin();
    }
    return {
      stop: () => {
        if (current() && recognizerBusy) recognition.stop();
      },
    };
  },
};

/**
 * Dev-only provider (NEXT_PUBLIC_SPEECH_MOCK=1): "hears" a fixed Thai
 * sentence, so the voice → parse → preview flow can be exercised on
 * desktop browsers without a microphone.
 */
export const mockSpeechProvider: SpeechProvider = {
  name: "mock",
  isSupported: () => true,
  start({ continuous, onTranscript, onEnd }) {
    const timer = setTimeout(() => {
      onTranscript(
        continuous
          ? "กินข้าว 40 บาท น้ำ 10 บาท ขนม 50 วินมอไซต์ 40 ไปกลับ 80 วันนี้เงินเดือนออก 20,000 แม่ให้ 2,000"
          : "เมื่อกี้กินข้าว 120 บาท จ่ายเงินสด",
        true
      );
      if (!continuous) onEnd();
    }, 900);
    return {
      stop: () => {
        clearTimeout(timer);
        if (continuous) onEnd();
      },
    };
  },
};

function getSpeechProvider(): SpeechProvider {
  return process.env.NEXT_PUBLIC_SPEECH_MOCK === "1" ? mockSpeechProvider : browserSpeechProvider;
}

/**
 * `supported` is false where no recognizer exists — callers hide the mic
 * (or explain) rather than showing a dead button. `onTranscript` receives
 * the running transcript; `isFinal` is true for the finished utterance.
 */
export function useSpeechInput(locale: string, onTranscript: (text: string, isFinal: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  // Hold-to-talk: browsers end a recognition session on a pause, so while
  // the button is held a new session starts and its words are appended.
  const holdingRef = useRef(false);
  const holdBaseRef = useRef("");
  const holdCurrentRef = useRef("");
  const holdRestartsRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    // Only knowable on the client, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechProvider().isSupported());
    return () => sessionRef.current?.stop();
  }, []);

  function start() {
    if (listening) return;
    setError(null);
    try {
      sessionRef.current = getSpeechProvider().start({
        lang: locale === "th" ? "th-TH" : "en-US",
        onTranscript: (text, isFinal) => onTranscriptRef.current(text, isFinal),
        onEnd: () => setListening(false),
        onError: (e) => {
          // "no-speech"/"aborted" are normal ends, not failures worth showing.
          if (e !== "aborted" && e !== "no-speech") setError(e);
          setListening(false);
        },
      });
      setListening(true);
    } catch {
      setListening(false);
      setError("start-failed");
    }
  }

  function stop() {
    holdingRef.current = false;
    sessionRef.current?.stop();
  }

  function joinSpeech(a: string, b: string) {
    return [a.trim(), b.trim()].filter(Boolean).join(" ");
  }

  function startHoldSession(lang: string) {
    sessionRef.current = getSpeechProvider().start({
      lang,
      continuous: true,
      onTranscript: (text) => {
        holdCurrentRef.current = text;
        onTranscriptRef.current(joinSpeech(holdBaseRef.current, text), false);
      },
      onEnd: () => {
        // Commit what this session heard; keep going while still held.
        holdBaseRef.current = joinSpeech(holdBaseRef.current, holdCurrentRef.current);
        holdCurrentRef.current = "";
        // Bounded, so a recognizer that keeps failing can never loop forever.
        if (holdingRef.current && holdRestartsRef.current < 40) {
          holdRestartsRef.current += 1;
          try {
            startHoldSession(lang);
            return;
          } catch {
            holdingRef.current = false;
          }
        }
        setListening(false);
        onTranscriptRef.current(holdBaseRef.current, true);
      },
      onError: (e) => {
        if (e === "not-allowed" || e === "service-not-allowed" || e === "unsupported") {
          holdingRef.current = false;
          setError(e);
        }
      },
    });
  }

  /** Press: start listening; words are appended after `baseText` (what's already in the box). */
  function startHold(baseText = "") {
    if (holdingRef.current) return;
    setError(null);
    holdingRef.current = true;
    holdBaseRef.current = baseText;
    holdCurrentRef.current = "";
    holdRestartsRef.current = 0;
    try {
      startHoldSession(locale === "th" ? "th-TH" : "en-US");
      setListening(true);
    } catch {
      holdingRef.current = false;
      setListening(false);
      setError("start-failed");
    }
  }

  /** Release: stop; the final transcript arrives through onTranscript(text, true). */
  function stopHold() {
    holdingRef.current = false;
    sessionRef.current?.stop();
  }

  function toggle() {
    if (listening) stop();
    else start();
  }

  return { supported, listening, error, start, stop, toggle, startHold, stopHold };
}
