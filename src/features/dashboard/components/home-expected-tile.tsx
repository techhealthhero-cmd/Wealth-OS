import "server-only";

import { getReceivablesSummary } from "@/features/invoices/queries";
import { HomeExpectedTileCard, type HomeExpectedTileProps } from "./home-tiles";

/** Read-only loader; unavailable invoices quietly retain Home's empty state. */
async function loadReceivables(today: string): Promise<HomeExpectedTileProps["receivables"]> {
  try {
    const summary = await getReceivablesSummary(today);
    return "error" in summary ? null : summary;
  } catch {
    return null;
  }
}

export async function HomeExpectedTile({ today, ...props }: Omit<HomeExpectedTileProps, "receivables"> & { today: string }) {
  const receivables = await loadReceivables(today);
  return <HomeExpectedTileCard {...props} receivables={receivables} />;
}
