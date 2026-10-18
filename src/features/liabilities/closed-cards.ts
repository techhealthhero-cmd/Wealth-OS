"use client";

import { createClosedCardsStore } from "@/lib/closed-cards-store";

const store = createClosedCardsStore("wealthos.closedLiabilityCards");

export const setLiabilityCardClosed = store.setClosed;
export const useLiabilityCardClosed = store.useClosed;
