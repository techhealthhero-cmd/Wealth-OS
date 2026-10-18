"use client";

import { createClosedCardsStore } from "@/lib/closed-cards-store";

// Key unchanged since before the store was shared, so cards existing users
// already closed stay closed.
const store = createClosedCardsStore("wealthos.closedAccountCards");

export const setAccountCardClosed = store.setClosed;
export const useAccountCardClosed = store.useClosed;
