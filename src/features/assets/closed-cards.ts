"use client";

import { createClosedCardsStore } from "@/lib/closed-cards-store";

const store = createClosedCardsStore("wealthos.closedAssetCards");

export const setAssetCardClosed = store.setClosed;
export const useAssetCardClosed = store.useClosed;
