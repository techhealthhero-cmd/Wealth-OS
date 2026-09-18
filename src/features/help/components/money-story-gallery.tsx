"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface StoryPage {
  src: string;
  width: number;
  height: number;
}

interface MoneyStoryGalleryProps {
  pages: StoryPage[];
  pageLabel: string; // e.g. "หน้า {current}/{total}" with placeholders already resolved per-render
}

/**
 * Horizontal, swipeable page-by-page comic viewer — CSS scroll-snap does the
 * actual paging (works with touch/trackpad natively, no drag library
 * needed); the only JS here is a scroll listener to keep the "หน้า X/6"
 * caption in sync with whichever page is currently snapped into view.
 */
export function MoneyStoryGallery({ pages, pageLabel }: MoneyStoryGalleryProps) {
  const [current, setCurrent] = useState(1);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const pageWidth = el.clientWidth;
    const index = Math.round(el.scrollLeft / pageWidth);
    setCurrent(Math.min(pages.length, Math.max(1, index + 1)));
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((page, i) => (
          <div key={page.src} className="w-full shrink-0 snap-center overflow-hidden rounded-xl border bg-muted">
            <Image
              src={page.src}
              alt={`${pageLabel.replace("{current}", String(i + 1))}`}
              width={page.width}
              height={page.height}
              className="h-auto w-full"
              sizes="(min-width: 640px) 640px, 100vw"
              priority={i === 0}
            />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {pageLabel.replace("{current}", String(current)).replace("{total}", String(pages.length))}
      </p>
    </div>
  );
}
