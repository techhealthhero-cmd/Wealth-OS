import { Charm } from "next/font/google";

/**
 * Thai handwriting face for words "written" into the journal — the voice
 * notebook's live transcript. Its own module, so only screens that write
 * by hand load it.
 */
export const handFont = Charm({
  subsets: ["thai", "latin"],
  weight: ["400", "700"],
  display: "swap",
});
