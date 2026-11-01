import { Mali } from "next/font/google";

/**
 * School-notebook hand for the Home year headings and goal notes.
 * Its own module so only that section loads it.
 */
export const notebookHand = Mali({
  subsets: ["latin", "thai"],
  weight: ["600", "700"],
  display: "swap",
});
