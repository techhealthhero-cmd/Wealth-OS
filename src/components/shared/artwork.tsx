import { cn } from "@/lib/utils";

/**
 * One of the hand-drawn gouache pictures under public/artwork/ (2026-10-15).
 * Always decorative: the label or number it sits beside says what it means,
 * so it never stands in for a real figure. Pre-sized local WebPs need no
 * optimizer pass, hence a plain <img>. Size it with `className` (e.g. w-24);
 * height follows the file's own aspect ratio — 3:2, or 1:1 with `square`.
 */
export function Artwork({ src, square, className }: { src: string; square?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={360}
      height={square ? 360 : 240}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("h-auto shrink-0 select-none", className)}
    />
  );
}
