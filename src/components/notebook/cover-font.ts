import { Cormorant_Garamond } from "next/font/google";

/**
 * Engraved-serif face for the embossed "WEALTH OS / Your Financial Journal"
 * on notebook covers only. Lives in its own module so pages without a cover
 * never load it (Latin subset, two weights — a few KB).
 */
export const coverSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
