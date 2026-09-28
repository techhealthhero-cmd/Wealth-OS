"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    // Floating pill treatment: inset from the screen edges and elevated with
    // `shadow-card` instead of the old edge-to-edge bar with a top border.
    // The +1rem this adds beyond the old bar's height is why every page's
    // bottom-nav clearance (`pb-24` / `pb-[calc(6rem+...)]`) was bumped by
    // 1rem in the same change — see those pages for the matching half.
    <div
      className="fixed inset-x-0 bottom-0 z-30 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] md:hidden"
    >
      {/* Progressive "frosted glass" fade behind the pill (reported: content
          scrolled underneath the floating nav looked sharp right up to its
          edge, unlike a reference app where it blurs/fades out gradually as
          it nears the bar). A backdrop-blur alone would apply uniformly and
          look like a hard-edged blurred rectangle; the mask-image gradient
          makes the blur itself fade in gradually toward the bottom instead,
          which is what actually reads as "frosted." Purely decorative
          (aria-hidden) and non-interactive so it never blocks taps on the
          content peeking through the gaps around the pill. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-28 bottom-0 -z-10 backdrop-blur-lg [-webkit-mask-image:linear-gradient(to_top,black_45%,transparent_100%)] [mask-image:linear-gradient(to_top,black_45%,transparent_100%)]"
      />
      <nav
        className="mx-auto flex max-w-md items-center justify-between rounded-3xl bg-background/95 px-1 py-1.5 shadow-card backdrop-blur supports-[backdrop-filter]:bg-background/80"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors duration-(--motion-normal) ease-(--ease-standard)",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
