"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { deleteTransaction } from "@/features/transactions/actions";

/** How long a swiped-away item can still be brought back. */
export const UNDO_WINDOW_MS = 5000;

/**
 * Swipe-to-delete with undo, shared by the Daily Inbox and the transaction
 * list. Items are hidden at once and actually deleted only once the undo
 * window has passed — a mis-swipe costs nothing. Our own timer decides when
 * the delete happens, not the toast's lifecycle (which pauses while the
 * screen is being touched). Leaving the page commits any deletes still
 * waiting; a failed delete brings the item back.
 */
export function useUndoableDelete(labels: { deleted: string; undo: string; failed: string }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function unhide(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function commitDelete(id: string) {
    if (!pendingDeletes.current.has(id)) return; // undone, or already sent
    pendingDeletes.current.delete(id);
    const res = await deleteTransaction(id);
    if (!res.success) {
      unhide(id);
      toast.error(res.error ?? labels.failed);
    }
  }

  function deleteWithUndo(id: string, description: string) {
    pendingDeletes.current.set(
      id,
      setTimeout(() => void commitDelete(id), UNDO_WINDOW_MS)
    );
    setHiddenIds((prev) => new Set(prev).add(id));
    toast(labels.deleted, {
      description,
      duration: UNDO_WINDOW_MS,
      action: {
        label: labels.undo,
        onClick: () => {
          const timer = pendingDeletes.current.get(id);
          if (timer === undefined) return; // already deleted
          clearTimeout(timer);
          pendingDeletes.current.delete(id);
          unhide(id);
        },
      },
    });
  }

  // Leaving the page never loses a delete the user asked for.
  useEffect(() => {
    const waiting = pendingDeletes.current;
    return () => {
      for (const [id, timer] of waiting) {
        clearTimeout(timer);
        void deleteTransaction(id);
      }
      waiting.clear();
    };
  }, []);

  return { hiddenIds, deleteWithUndo };
}
