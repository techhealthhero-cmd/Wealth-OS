"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";

// Requested: a subtle glossy/lit-from-above sheen on the pill instead of a
// completely flat fill (reference: a photo of a capsule with a soft
// highlight streak across it). A literal diagonal linear-gradient was
// considered and rejected — the bar and the floating bump are two SEPARATE
// elements, and a gradient computed per-element restarts at each one's own
// box, so it would show a hard visible seam exactly where the bump overlaps
// the bar (breaking the "one continuous blob" look the notch depends on).
// A radial highlight anchored above BOTH elements' own top edge instead
// reads as "one light source from above" without needing pixel-perfect
// alignment between them — applied identically to the bar and the bump so
// they stay visually one piece. Also deliberately restrained (14% white,
// fades out by 70%) — GRAPHICS_PLAN.md's flat, no-gradient/glow button
// system was a deliberate earlier decision; this is a narrow, explicit
// exception for this one component, not a reversal of that rule elsewhere.
const GLOSSY_PRIMARY_BG =
  "radial-gradient(120% 60% at 50% -20%, rgba(255,255,255,0.16), transparent 70%), var(--primary)";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const activeIndex = NAV_ITEMS.findIndex(
    (item) => pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
  );
  // Some routes behind (app)/layout.tsx (e.g. /profile, /billing, /help)
  // don't belong to any of the 5 tabs — no bump/notch in that case, just a
  // plain pill, rather than defaulting to some arbitrary tab looking active.
  const hasActive = activeIndex !== -1;
  const bumpXPercent = ((hasActive ? activeIndex : 0) + 0.5) * (100 / NAV_ITEMS.length);
  const ActiveIcon = hasActive ? NAV_ITEMS[activeIndex].icon : null;

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
          content peeking through the gaps around the pill.
          Reported again: an earlier version extended this well above the
          nav's own box (`-top-28`) so it could reach content a bit further
          up the page — but on a real page that meant it also blurred
          legitimate cards that just happened to scroll near the bottom
          (e.g. the "Next Best Action" card), which reads as a bug, not a
          nice fade. Confined to `inset-0` (exactly the nav wrapper's own
          box — the pill plus its immediate top/bottom padding) instead, so
          only the area actually behind/around the bar fades, never content
          above it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-lg [-webkit-mask-image:linear-gradient(to_top,black_55%,transparent_100%)] [mask-image:linear-gradient(to_top,black_55%,transparent_100%)]"
      />
      {/* "Bump" nav (reference: a solid pill whose active tab pokes up out of
          the bar as a raised circle, with the bar's own top edge curving
          smoothly down into a valley on either side of it — a liquid/blob
          look, not a separate floating button). Two pieces make this work:
          1) `mask-image` punches a circular hole in the bar's own top edge,
             centered on the active tab (`var(--bump-x)`) — this alone
             creates the "valley" dip on both sides.
          2) The floating circle below (same solid color, positioned to
             overlap that hole from above) reads as the "hill" rising out of
             it — since both are the identical fill color, the seam between
             them is invisible and the two curves read as one continuous
             wave, exactly like the reference.
          `--bump-x` is a `@property`-registered percentage (see globals.css)
          specifically so both consumers (the mask's gradient center and the
          circle's `left`) can be driven by ONE transitioning value — they
          move in lockstep with a single `transition: --bump-x ...` instead
          of needing two separately-tuned animations that could drift out of
          sync. */}
      <nav
        // `isolate` matters, not just decoration: `relative` alone doesn't
        // give this element its own stacking context, so the background
        // layer's `-z-10` below would otherwise escape to the fixed
        // wrapper's context (which DOES have a z-index) and render behind
        // nearly the whole page instead of just behind this nav's own icons/
        // bump — verified via a forced local render: the bar vanished
        // entirely (bump/icons floated with no pill visible) until this was
        // added.
        className="isolate relative mx-auto flex max-w-md items-center justify-between px-1 py-1.5"
        style={
          {
            "--bump-x": `${bumpXPercent}%`,
            transition: "--bump-x var(--motion-normal) var(--ease-standard)",
          } as CSSProperties
        }
        aria-label="Primary"
      >
        {/* Bar background lives on its own layer, separate from the items/
            bump below — `mask-image` clips an element's ENTIRE rendered
            output, descendants included, not just its own background. Put
            it on `<nav>` itself and the mask would cut the bump (a child)
            out of existence right where it's supposed to show, along with
            any icon/label that happened to fall under the hole — exactly
            what happened before this was split out (verified via a forced
            local render: the cutout appeared but the bump/icon never did).
            As a sibling instead, the mask only ever touches this one
            background div; the items row and the bump paint on top of it,
            fully unaffected. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 -z-10 rounded-3xl shadow-card",
            hasActive &&
              "[-webkit-mask-image:radial-gradient(circle_27px_at_var(--bump-x)_0,transparent_26px,black_29px)] [mask-image:radial-gradient(circle_27px_at_var(--bump-x)_0,transparent_26px,black_29px)]"
          )}
          style={{ background: GLOSSY_PRIMARY_BG }}
        />
        {NAV_ITEMS.map((item, index) => {
          const active = index === activeIndex;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors duration-(--motion-normal) ease-(--ease-standard)",
                active ? "font-semibold text-primary-foreground" : "text-primary-foreground/70"
              )}
              aria-current={active ? "page" : undefined}
            >
              {/* The active tab's own icon is invisible, not removed — its
                  layout space keeps the label centered under where the icon
                  would be; the icon actually seen is the floating one below,
                  raised out of the bar. */}
              <item.icon className={cn("h-5 w-5", active && "opacity-0")} aria-hidden="true" />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
        {hasActive && ActiveIcon ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 flex size-14 -translate-x-1/2 items-center justify-center rounded-full shadow-card"
            style={{ left: "var(--bump-x)", background: GLOSSY_PRIMARY_BG }}
          >
            <ActiveIcon className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>
        ) : null}
      </nav>
    </div>
  );
}
