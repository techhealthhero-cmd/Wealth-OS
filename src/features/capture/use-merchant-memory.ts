"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createMerchantMemory, type MerchantMemoryEntry } from "@/lib/capture/merchant-memory";
import type { ParseContext } from "@/lib/capture/transaction-parser";
import { confirmedMemoryObservation } from "@/lib/capture/capture-memory-signal";
import { resolveMemoryIdentity } from "@/lib/capture/capture-memory-identity";
import type { CaptureDraft } from "@/lib/capture/draft";

/** Identity comes from the existing browser session; no shared anonymous memory. */
export function useMerchantMemory(open: boolean) {
  const [state, setState] = useState<{ userId: string | null; entries: MerchantMemoryEntry[] }>({ userId: null, entries: [] });
  const identity = useRef<{ userId: string | null }>({ userId: null });
  useEffect(() => {
    const client = createClient();
    let active = true;
    let changed = false;
    const update = (userId: string | null) => {
      if (!active) return;
      identity.current = { userId };
      setState({ userId, entries: createMerchantMemory(userId).load() });
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => { changed = true; update(session?.user.id ?? null); });
    void client.auth.getSession().then(({ data }) => { if (!changed) update(data.session?.user.id ?? null); }).catch(() => { if (!changed) update(null); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [open]);
  return {
    entries: state.entries,
    /** Call only after a successful explicit Save. The returned callback removes this observation on undo. */
    async remember(text: string, final: CaptureDraft, context: ParseContext): Promise<() => void> {
      const observation = confirmedMemoryObservation(text, final, context);
      if (!observation) return () => {};
      const userId = await resolveMemoryIdentity(identity, state.userId, async () => {
        const { data } = await createClient().auth.getSession();
        return data.session?.user.id ?? null;
      });
      if (!userId || identity.current.userId !== userId) return () => {};
      const repo = createMerchantMemory(userId);
      const undo = repo.learnWithUndo(observation);
      setState({ userId, entries: repo.load() });
      let undone = false;
      return () => {
        if (undone) return;
        undone = true;
        undo();
        if (identity.current.userId === userId) setState({ userId, entries: repo.load() });
      };
    },
  };
}
