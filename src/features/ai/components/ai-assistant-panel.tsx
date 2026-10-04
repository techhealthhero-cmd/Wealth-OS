"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronRight, ExternalLink, X } from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import {
  COMPANION_SUGGESTION_KEYS,
  getCompanion,
  type CompanionFocus,
  type CompanionTheme,
} from "@/lib/companions/catalog";
import { FEATURES } from "@/lib/billing/plans";
import { getAiOverlayData, type AiOverlayData } from "@/features/ai/actions/get-overlay-data";
import { AICoachChat } from "./ai-coach-chat";

/** Where the floating AI button currently sits (px from the viewport's top-left). */
export interface PanelAnchor {
  x: number;
  y: number;
  size: number;
}

const EDGE_PX = 12;
const TOP_RESERVE_PX = 64; // clear of the status bar / page header
const BOTTOM_NAV_RESERVE_PX = 104;
const MAX_HEIGHT_PX = 720;

/**
 * One fixed frame for the window, wherever the companion button sits
 * (2026-10-04): it used to be sized/placed around the button — short when
 * the button was low, the button floating on top of it when it was mid-
 * screen — so the window looked different every time. Now it always
 * occupies the same comfortable spot (full width minus equal margins,
 * resting just above the bottom nav, as tall as fits up to 720px) and the
 * freedom lives in the motion: it still grows out of — and shrinks back
 * into — the button, wherever the user dragged it.
 */
const PANEL_FRAME: CSSProperties = {
  left: EDGE_PX,
  right: EDGE_PX,
  marginInline: "auto",
  bottom: BOTTOM_NAV_RESERVE_PX,
  height: `min(${MAX_HEIGHT_PX}px, calc(100dvh - env(safe-area-inset-top) - ${TOP_RESERVE_PX + BOTTOM_NAV_RESERVE_PX}px))`,
};

/**
 * Requested: match a reference design's floating AI widget — a card that
 * floats next to the AI button (rounded on all corners, inset from every
 * edge) rather than an edge-anchored bottom sheet, with a "{name} AI"
 * header and Chat/Summary/Analyze/Tools icon tabs. Built directly on Base
 * UI's Dialog primitives since the shared `Sheet` only offers edge-anchored
 * positioning.
 *
 * `modal="trap-focus"`: focus stays inside, but pointer events outside keep
 * working. While open, the floating button itself steps aside (it "becomes"
 * the window — see FloatingAiButton); the header × and a tap outside close.
 *
 * The chat opens fresh each time on the companion's greeting and its 3
 * suggestions (see getAiOverlayData).
 */
export function AiAssistantPanel({
  open,
  onOpenChange,
  anchor,
  companion,
  alive = false,
  displayName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: PanelAnchor | null;
  /**
   * The active companion (2026-10-04): the panel becomes that companion's
   * own window — its name and tagline in the header, its colors (header
   * gradient, glow, and `--primary` for tabs/send button), its avatar and
   * its own greeting in the chat.
   */
  companion: { id: string; image: string; emoji: string; focus: CompanionFocus; theme: CompanionTheme };
  /** Plus/Pro presence on: the header avatar floats like the button does. */
  alive?: boolean;
  /** From the layout's profile, so the greeting is personal before any data loads. */
  displayName?: string | null;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiOverlayData | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Requested 2026-10-04: closing shrinks the panel back INTO the AI button,
  // so the transform origin must sit exactly on the button's center, in the
  // popup's own coordinates. offsetLeft/Top (not getBoundingClientRect) so the
  // in-flight scale transform doesn't skew the measurement. Runs on close too
  // (the popup stays mounted through its exit transition).
  const aimAtButton = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !anchor) return;
      const cx = anchor.x + anchor.size / 2 - el.offsetLeft;
      const cy = anchor.y + anchor.size / 2 - el.offsetTop;
      el.style.transformOrigin = `${cx}px ${cy}px`;
    },
    [anchor]
  );
  // Ref callback: aims the instant the window element mounts, before its
  // first animated frame (the portal can mount after this component's own
  // layout effects). The layout effect re-aims if the button moved.
  const setPopupEl = useCallback(
    (el: HTMLDivElement | null) => {
      popupRef.current = el;
      aimAtButton(el);
    },
    [aimAtButton]
  );
  useLayoutEffect(() => {
    aimAtButton(popupRef.current);
  }, [open, aimAtButton]);

  // Re-fetched on every open (the previous data stays on screen meanwhile)
  // so the greeting's real-data line is current and matches the companion
  // the user may have switched to since last time.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAiOverlayData()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch(() => {
        // Non-blocking: the chat already works without it; the greeting just
        // keeps the companion's default line.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const title = t(`companions.names.${companion.id}`);
  const userName = data?.displayName ?? displayName ?? t("companions.you");
  const tagline = t(`companions.taglines.${companion.id}`).replace("{name}", userName);
  // "สาย" (line) = the specialty; family = spirit/wizard + how it was gained.
  const definition = getCompanion(companion.id);
  const lineLabel = t(`companions.lines.${companion.focus}`);
  const familyLabel =
    definition?.access.type === "plan"
      ? `${t(`companions.kinds.${definition.kind}`)} · ${
          definition.access.feature === FEATURES.COMPANION_PRO_WIZARD ? "Pro" : "Plus"
        }`
      : `${t(`companions.kinds.${definition?.kind ?? "spirit"}`)} · ${
          definition?.access.type === "starter" ? t("companions.starter") : t("companions.earned")
        }`;
  // The greeting carries one real fact from the user's data when there is
  // one (same deterministic tip the companion's speech bubble uses);
  // otherwise the companion's own introduction line.
  const greeting = {
    title: t(`companions.greetings.${companion.id}.title`).replace("{name}", userName),
    body: data?.greetingTip
      ? `${t("companions.greetingTipLead")} ${data.greetingTip}`
      : t(`companions.greetings.${companion.id}.body`),
  };
  const { theme } = companion;
  // Re-theme everything inside the panel that uses the app's primary color
  // (active tab, send button, focus ring, chips) to this companion's own.
  // Mid-lightness primaries + white foreground read well in light and dark.
  const themeVars = {
    "--primary": theme.primary,
    "--primary-foreground": "oklch(0.985 0 0)",
    "--ring": theme.primary,
  } as CSSProperties;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal="trap-focus">
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/15 transition-opacity duration-(--motion-companion-open) ease-(--ease-companion) data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-(--motion-companion-close)" />
        <DialogPrimitive.Popup
          ref={setPopupEl}
          style={{ ...PANEL_FRAME, ...themeVars }}
          className={cn(
            "fixed z-50 flex max-w-[25rem] flex-col overflow-hidden rounded-3xl border bg-popover text-popover-foreground shadow-2xl [will-change:scale,opacity]",
            // Requested 2026-10-04 ("smoother — grow open slowly, shrink
            // closed slowly"): the window grows OUT of the companion button
            // and shrinks back INTO it, both from the button's exact center
            // (transform-origin set by the layout effect above), on one
            // soft decelerating curve (--ease-companion). Opening fades in
            // quickly so the growing shape is visible at once; closing keeps
            // it visible while it shrinks and fades only at the very end.
            "[transition:scale_var(--motion-companion-open)_var(--ease-companion),opacity_220ms_ease-out]",
            "data-starting-style:scale-[0.04] data-starting-style:opacity-0",
            "data-ending-style:scale-[0.04] data-ending-style:opacity-0 data-ending-style:[transition:scale_var(--motion-companion-close)_var(--ease-companion),opacity_260ms_ease-in_calc(var(--motion-companion-close)_-_260ms)]"
          )}
        >
          {/* Header — the companion's own colors: its gradient, a glow taken
              from its art behind the avatar, and its emoji as a faint
              watermark. */}
          <div
            className="relative flex shrink-0 items-start justify-between gap-2 overflow-hidden px-4 pt-4 pb-3 text-white"
            style={{
              background: `radial-gradient(70% 140% at 12% 30%, color-mix(in oklab, ${theme.glow} 38%, transparent), transparent 70%), radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(135deg, ${theme.headerFrom}, ${theme.headerTo})`,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -bottom-5 text-7xl leading-none opacity-[0.13] select-none"
            >
              {companion.emoji}
            </span>
            {/* Identity block (2026-10-04): who you're talking to and what
                "line" (สาย) they specialize in, at a glance — name, a
                specialty chip, a family/tier chip, then the tagline. The
                whole block links to /companions to switch. */}
            <Link
              href="/companions"
              onClick={() => onOpenChange(false)}
              aria-label={`${title} · ${lineLabel} — ${t("companions.switchCompanion")}`}
              className="relative flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
            >
              <span
                className={cn(
                  "shrink-0 rounded-full",
                  alive && "motion-safe:animate-[companion-float_6s_ease-in-out_infinite]"
                )}
                style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${theme.glow} 70%, transparent), 0 0 18px 2px color-mix(in oklab, ${theme.glow} 45%, transparent)` }}
              >
                <Image src={companion.image} alt="" width={48} height={48} className="size-12 rounded-full object-cover" />
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="flex items-center gap-1 font-heading text-lg font-semibold leading-tight">
                  <span className="truncate">{title}</span>
                  <ChevronRight className="size-4 shrink-0 text-white/60" aria-hidden="true" />
                </DialogPrimitive.Title>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      // White text on a glow-tinted fill: readable on every
                      // header, light (leaf/mint) or near-black (shadow).
                      background: `color-mix(in oklab, ${theme.glow} 30%, rgba(0,0,0,0.25))`,
                      color: "white",
                      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${theme.glow} 65%, transparent)`,
                    }}
                  >
                    <span aria-hidden="true">{companion.emoji}</span>
                    {lineLabel}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white/80 ring-1 ring-white/25">
                    {familyLabel}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-white/75">{tagline}</p>
              </div>
            </Link>
            <div className="relative flex shrink-0 items-center gap-0.5">
              <Link
                href="/ai"
                onClick={() => onOpenChange(false)}
                aria-label={t("aiCoach.openFullPage")}
                className="flex size-8 items-center justify-center rounded-full text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <ExternalLink className="size-4.5" aria-hidden="true" />
              </Link>
              <DialogPrimitive.Close
                aria-label={t("common.close")}
                className="flex size-8 items-center justify-center rounded-full text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Chat only (2026-10-04 simplification): the Summary / Analyze /
              Tools tabs repeated the dashboard and the bottom nav, so the
              window is now just "talk to your companion". The full /ai page
              (header ⧉) still has everything. */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* No loading screen (2026-10-04, "never make them wait"): the
                chat is usable the instant the window opens — the greeting
                uses the companion's own line and the name from the layout,
                and the real-data tip slides in when it arrives. */}
            <AICoachChat
              variant="overlay"
              displayName={data?.displayName ?? displayName ?? null}
              historyEnabled={data?.historyEnabled ?? false}
              greeting={greeting}
              avatarImage={companion.image}
              suggestionKeys={COMPANION_SUGGESTION_KEYS[companion.focus]}
              thinkingLead={t(`companions.thinking.${companion.id}`)}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
