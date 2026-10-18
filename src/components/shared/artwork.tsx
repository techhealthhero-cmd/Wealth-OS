import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * One of the hand-drawn gouache pictures under public/artwork/ (2026-10-15).
 * Always decorative: the label or number it sits beside says what it means,
 * so it never stands in for a real figure. Size it with `className` (e.g.
 * w-24); height follows the file's own aspect ratio — 3:2, 1:1 with
 * `square`, or the 720x289 panorama with `wide`. Next Image keeps the
 * reserved aspect ratio and serves the small local WebPs at an appropriate
 * size for the device.
 */
export function Artwork({
  src,
  square,
  wide,
  priority,
  className,
}: {
  src: string;
  square?: boolean;
  wide?: boolean;
  /** Above-the-fold hero art: load eagerly instead of lazily. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      priority={priority}
      alt=""
      aria-hidden="true"
      width={wide ? 720 : 360}
      height={wide ? 289 : square ? 360 : 240}
      draggable={false}
      className={cn("h-auto shrink-0 select-none", className)}
    />
  );
}
