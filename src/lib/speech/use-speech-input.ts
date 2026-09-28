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
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** On-device/browser recognition (Safari, Chrome). Nothing is sent to our servers. */
export const browserSpeechProvider: SpeechProvider = {
  name: "browser",
  isSupported: () => getSpeechRecognitionCtor() !== null,
  start({ lang, onTranscript, onEnd, onError }) {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError("unsupported");
      onEnd();
      return { stop() {} };
    }
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const text = results.map((r) => r[0]?.transcript ?? "").join("");
      onTranscript(text, results.every((r) => r.isFinal !== false));
    };
    recognition.onend = onEnd;
    recognition.onerror = (event) => onError(event?.error ?? "error");
    recognition.start();
    return { stop: () => recognition.stop() };
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
  start({ onTranscript, onEnd }) {
    const timer = setTimeout(() => {
      onTranscript("เมื่อกี้กินข้าว 120 บาท จ่ายเงินสด", true);
      onEnd();
    }, 900);
    return { stop: () => clearTimeout(timer) };
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
    sessionRef.current?.stop();
  }

  function toggle() {
    if (listening) stop();
    else start();
  }

  return { supported, listening, error, start, stop, toggle };
}
