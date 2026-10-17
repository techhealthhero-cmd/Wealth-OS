import Image from "next/image";

import { categoryArt, categoryEmoji } from "@/lib/transaction-ui";
import { cn } from "@/lib/utils";

/**
 * A category's picture (2026-10-14): the hand-drawn gouache sticker from
 * public/artwork/categories/ when that category has one, else its emoji.
 * Decorative — the category's name is always written next to it.
 * `emoji` overrides the fallback (e.g. a drink icon refined from the item text).
 */
export function CategoryIcon({
  icon,
  emoji,
  className,
}: {
  icon: string | null | undefined;
  emoji?: string;
  /** Sizes the sticker (default 2rem); the emoji fallback keeps the text size. */
  className?: string;
}) {
  const art = categoryArt(icon ?? null);
  if (!art || (emoji && emoji !== categoryEmoji(icon ?? null))) {
    return <span aria-hidden="true">{emoji ?? categoryEmoji(icon ?? null)}</span>;
  }
  return (
    <Image
      src={art}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      draggable={false}
      className={cn("size-8 shrink-0 select-none", className)}
    />
  );
}
