"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { captureLayout, countCaptureEffort, shouldSuggestLargeText, type CaptureViewport, type SuggestionSession } from "@/lib/capture/capture-display";
import { createCaptureDeviceStore, createCaptureSessionStore, type UnsureAnswer } from "@/lib/capture/capture-device-store";

export function useCaptureViewport(enabled: boolean) {
  const [viewport, setViewport] = useState<CaptureViewport | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewport({ layoutHeight: document.documentElement.clientHeight || window.innerHeight, height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale });
    update();
    vv.addEventListener("resize", update); vv.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [enabled]);
  return { layout: enabled ? captureLayout(viewport) : "a", viewport };
}

const sessions = new Map<string, SuggestionSession>();
/** Settings hydrate after mount; identities never share settings or session counters. */
export function useCaptureDisplay() {
  const [state, setState] = useState({ userId: null as string | null, largeText: false, revision: 0 });
  const [suggestion, setSuggestion] = useState(false);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    const client = createClient(); let active = true; let changed = false;
    const update = (userId: string | null) => {
      if (!active) return;
      const replaced = identity.current !== userId;
      identity.current = userId;
      setState(s => ({ userId, largeText: createCaptureDeviceStore(userId).largeText(), revision: s.revision + 1 }));
      if (replaced) setSuggestion(false);
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => { changed = true; update(session?.user.id ?? null); });
    void client.auth.getSession().then(({ data }) => { if (!changed) update(data.session?.user.id ?? null); }).catch(() => { if (!changed) update(null); });
    const refresh = () => update(identity.current);
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; largeText: boolean }>).detail;
      if (detail?.userId !== identity.current || typeof detail.largeText !== "boolean") return;
      setState(s => ({ ...s, largeText: detail.largeText }));
      if (detail.largeText) setSuggestion(false);
    };
    window.addEventListener("storage", refresh); window.addEventListener("capture-display-change", sync);
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener("storage", refresh); window.removeEventListener("capture-display-change", sync); };
  }, []);
  const current = () => identity.current === state.userId && state.userId !== null;
  const setLargeText = (enabled: boolean) => {
    if (!current()) return;
    createCaptureDeviceStore(state.userId).setLargeText(enabled);
    setState(s => ({ ...s, largeText: enabled })); setSuggestion(false);
    window.dispatchEvent(new CustomEvent("capture-display-change", { detail: { userId: state.userId, largeText: enabled } }));
  };
  const effort = () => {
    if (!current() || state.largeText) return;
    const id = state.userId!;
    const session = countCaptureEffort(sessions.get(id) ?? createCaptureSessionStore(id).load());
    if (shouldSuggestLargeText(session, state.largeText, createCaptureDeviceStore(id).dismissedAt(), Date.now())) {
      session.shown = true; setSuggestion(true);
    }
    sessions.set(id, session);
    createCaptureSessionStore(id).save(session);
  };
  return {
    largeText: state.largeText, ready: state.userId !== null, setLargeText, effort,
    suggestion: suggestion && !state.largeText,
    dismissSuggestion: () => { if (current()) createCaptureDeviceStore(state.userId).dismiss(Date.now()); setSuggestion(false); },
    answer: (text: string) => current() ? createCaptureDeviceStore(state.userId).answer(text) : null,
    remember: (text: string, answer: UnsureAnswer) => {
      if (!current()) return;
      createCaptureDeviceStore(state.userId).remember(text, answer);
      setState(s => ({ ...s, revision: s.revision + 1 }));
    },
  };
}
