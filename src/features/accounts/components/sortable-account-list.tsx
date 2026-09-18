"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Account } from "@/types/database";
import { reorderAccounts } from "@/features/accounts/actions";
import { AccountCard } from "./account-card";

function SortableAccountCard({ account }: { account: Account }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // touch-action: none is only applied once a drag has actually started
      // (isDragging), not permanently — the 250ms activation delay already
      // lets an ordinary quick scroll swipe fall through to the browser
      // untouched (it exceeds the 5px tolerance before the delay elapses,
      // so dnd-kit never claims the gesture); applying touch-none up front
      // instead would block page scrolling from starting anywhere on a card.
      className={isDragging ? "touch-none opacity-60" : undefined}
      {...attributes}
      {...listeners}
    >
      <AccountCard account={account} />
    </div>
  );
}

/**
 * Long-press-to-drag reordering for the active accounts list. A 250ms
 * activation delay (PointerSensor) is what makes this "press and hold, then
 * drag" rather than "any touch starts a drag" — a quick tap still reaches
 * AccountCard's own edit/menu buttons normally, and an ordinary vertical
 * scroll gesture (which moves further than the 5px tolerance before 250ms
 * is up) cancels the drag instead of hijacking the scroll.
 *
 * Order updates optimistically in local state on drop (so the reorder feels
 * instant) and is persisted via `reorderAccounts` in the background; a
 * failed save re-syncs from the server-confirmed `accounts` prop on its next
 * change rather than leaving the UI silently out of sync.
 */
export function SortableAccountList({ accounts }: { accounts: Account[] }) {
  const [items, setItems] = useState(accounts);
  // Re-syncs local (optimistically-reordered) state whenever the server
  // hands down a new `accounts` prop — e.g. another account archived/added
  // elsewhere revalidates this list. Adjusting state during render (React's
  // documented pattern for this exact case) rather than in a useEffect,
  // which would cause an extra render pass on every legitimate prop change.
  const [prevAccounts, setPrevAccounts] = useState(accounts);
  if (accounts !== prevAccounts) {
    setPrevAccounts(accounts);
    setItems(accounts);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((a) => a.id === active.id);
    const newIndex = items.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...items];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setItems(reordered);

    void reorderAccounts(reordered.map((a) => a.id));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-3">
          {items.map((account) => (
            <SortableAccountCard key={account.id} account={account} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
