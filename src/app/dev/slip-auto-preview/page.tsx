import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/dictionaries";
import { SlipAutoPreview, type PreviewScreen } from "./preview-client";

const SCREENS: PreviewScreen[] = ["pick", "reading", "review", "saved", "home", "detail"];

/**
 * Dev-only visual preview of the slip-auto UI with SAMPLE fixture data.
 * 404s unless NEXT_PUBLIC_SLIP_UI_PREVIEW=1, so it is never reachable on
 * staging/production. Usage: /dev/slip-auto-preview?screen=review
 *
 * Note: the auth proxy (src/proxy.ts) still applies — open it with a signed-in
 * session. It is deliberately NOT added to the public-route list.
 */
export default async function SlipAutoPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[] }>;
}) {
  if (process.env.NEXT_PUBLIC_SLIP_UI_PREVIEW !== "1") notFound();
  const { screen } = await searchParams;
  const value = Array.isArray(screen) ? screen[0] : screen;
  const current = SCREENS.find((s) => s === value) ?? "review";
  const dict = getDictionary("th");
  const netWorthLabels = {
    ...dict.homeNetWorth,
    noHistoryYet: dict.netWorth.noHistoryYet,
    viewAssetsAndLiabilities: dict.netWorth.viewAssetsAndLiabilities,
  };
  return <SlipAutoPreview screen={current} netWorthLabels={netWorthLabels} />;
}
