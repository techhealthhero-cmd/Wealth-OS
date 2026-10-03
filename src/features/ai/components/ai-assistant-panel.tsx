"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  ChartLine,
  CircleDollarSign,
  ExternalLink,
  FileChartColumn,
  Landmark,
  LayoutGrid,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { getAiOverlayData, type AiOverlayData } from "@/features/ai/actions/get-overlay-data";
import { AICoachChat } from "./ai-coach-chat";
import { FinancialSnapshotStrip } from "./financial-snapshot-strip";
import { NextBestActionCard } from "./next-best-action-card";
import { InsightCards } from "./insight-card";
import { MonthlyHealthCheckCard } from "./monthly-health-check-card";

type TabKey = "chat" | "summary" | "analyze" | "tools";

const TABS = [
  { key: "chat", icon: MessageCircle },
  { key: "summary", icon: FileChartColumn },
  { key: "analyze", icon: ChartLine },
  { key: "tools", icon: LayoutGrid },
] as const;

const TOOLS_TAB_LINKS = [
  { key: "debt", href: "/plan/debt", icon: Landmark },
  { key: "emergencyFund", href: "/plan/emergency-fund", icon: ShieldCheck },
  { key: "netWorth", href: "/money/net-worth", icon: CircleDollarSign },
  { key: "goals", href: "/plan/goals", icon: Target },
] as const;

/** Where the floating AI button currently sits (px from the viewport's top-left). */
export interface PanelAnchor {
  x: number;
  y: number;
  size: number;
}

const GAP_PX = 8;
const EDGE_PX = 12;
const TOP_RESERVE_PX = 56; // keeps the panel clear of the status bar / page header
const BOTTOM_NAV_RESERVE_PX = 104;
const MAX_HEIGHT_PX = 720;
const MIN_COMFORTABLE_HEIGHT_PX = 420;

/**
 * Places the panel next to the floating button, on the button's side of the
 * screen — above it when the button is in the lower half (the default spot),
 * below it otherwise. Falls back to a centered full-height layout when the
 * button's position leaves too little room either way.
 */
function computePlacement(anchor: PanelAnchor | null): CSSProperties {
  if (typeof window === "undefined" || !anchor) {
    return { top: TOP_RESERVE_PX, bottom: BOTTOM_NAV_RESERVE_PX, right: EDGE_PX };
  }
  const vh = window.innerHeight;
  const horizontal: CSSProperties =
    anchor.x + anchor.size / 2 >= window.innerWidth / 2 ? { right: EDGE_PX } : { left: EDGE_PX };

  const spaceAbove = anchor.y - GAP_PX - TOP_RESERVE_PX;
  const spaceBelow = vh - (anchor.y + anchor.size + GAP_PX) - BOTTOM_NAV_RESERVE_PX;

  if (spaceAbove >= MIN_COMFORTABLE_HEIGHT_PX && spaceAbove >= spaceBelow) {
    return { ...horizontal, bottom: vh - anchor.y + GAP_PX, height: Math.min(spaceAbove, MAX_HEIGHT_PX) };
  }
  if (spaceBelow >= MIN_COMFORTABLE_HEIGHT_PX) {
    return { ...horizontal, top: anchor.y + anchor.size + GAP_PX, height: Math.min(spaceBelow, MAX_HEIGHT_PX) };
  }
  return { ...horizontal, top: TOP_RESERVE_PX, bottom: BOTTOM_NAV_RESERVE_PX };
}

/**
 * Requested: match a reference design's floating AI widget — a card that
 * floats next to the AI button (rounded on all corners, inset from every
 * edge) rather than an edge-anchored bottom sheet, with a "{name} AI"
 * header and Chat/Summary/Analyze/Tools icon tabs. Built directly on Base
 * UI's Dialog primitives since the shared `Sheet` only offers edge-anchored
 * positioning.
 *
 * `modal="trap-focus"`: focus stays inside, but pointer events outside keep
 * working — needed so the floating button (rendered above the backdrop)
 * can be tapped again to close the panel, like the reference's "×" badge.
 *
 * Summary and Analyze reuse the exact cards the full /ai page renders, so
 * the numbers can't drift from that page. The chat opens fresh each time on
 * its greeting/quick-action screen (see getAiOverlayData).
 */
export function AiAssistantPanel({
  open,
  onOpenChange,
  anchor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: PanelAnchor | null;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AiOverlayData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<TabKey>("chat");
  const [placement, setPlacement] = useState<CSSProperties>({});
  const popupRef = useRef<HTMLDivElement>(null);

  // Requested 2026-10-04: closing shrinks the panel back INTO the AI button,
  // so the transform origin must sit exactly on the button's center, in the
  // popup's own coordinates. offsetLeft/Top (not getBoundingClientRect) so the
  // in-flight scale transform doesn't skew the measurement. Runs on close too
  // (the popup stays mounted through its exit transition).
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el || !anchor) return;
    const cx = anchor.x + anchor.size / 2 - el.offsetLeft;
    const cy = anchor.y + anchor.size / 2 - el.offsetTop;
    el.style.transformOrigin = `${cx}px ${cy}px`;
  }, [open, anchor, placement]);

  useEffect(() => {
    if (!open) return;
    // Depends on window size + where the button was dragged — client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlacement(computePlacement(anchor));
  }, [open, anchor]);

  useEffect(() => {
    // Every open starts on the chat tab, like the reference design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setTab("chat");
  }, [open]);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    getAiOverlayData()
      .then((result) => {
        if (cancelled) return;
        setLoadFailed(false);
        setData(result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  const title = data?.displayName ? `${data.displayName} AI` : t("aiCoach.title");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal="trap-focus">
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/15 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-(--motion-close) data-ending-style:ease-(--ease-close)" />
        <DialogPrimitive.Popup
          ref={popupRef}
          style={placement}
          className={cn(
            "fixed z-50 flex w-[min(calc(100vw-1.5rem),25rem)] flex-col overflow-hidden rounded-3xl border bg-popover text-popover-foreground shadow-2xl transition duration-150 ease-out",
            // Closing: unlike every other sheet/dialog (which slide down), the
            // AI panel slowly shrinks back into the AI button (--motion-close);
            // transform-origin is set to the button's center by the layout
            // effect above. The fade is held back to the last stretch so the
            // panel stays visible while it shrinks. Opening keeps the quick
            // scale-in.
            "data-ending-style:scale-[0.04] data-ending-style:opacity-0 data-ending-style:[transition:scale_var(--motion-close)_var(--ease-close),opacity_300ms_ease-in_800ms] data-starting-style:scale-95 data-starting-style:opacity-0",
            anchor && anchor.x + anchor.size / 2 < (typeof window === "undefined" ? 0 : window.innerWidth / 2)
              ? "origin-bottom-left"
              : "origin-bottom-right"
          )}
        >
          {/* Header — dark green gradient, as in the reference design. */}
          <div
            className="flex shrink-0 items-start justify-between gap-2 px-4 pt-4 pb-3 text-primary-foreground"
            style={{
              background:
                "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.14), transparent 60%), linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 78%, black))",
            }}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <Sparkles className="mt-0.5 size-7 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <DialogPrimitive.Title className="truncate font-heading text-lg font-semibold leading-tight">
                  {title}
                </DialogPrimitive.Title>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-primary-foreground/85">
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                  {t("aiCoach.panelStatus")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
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

          {/* Tabs — icon + label, active one filled dark green. */}
          <div role="tablist" aria-label={title} className="grid shrink-0 grid-cols-4 gap-1 border-b bg-muted/40 px-2 py-2">
            {TABS.map(({ key, icon: Icon }) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-2 text-xs font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(`aiCoach.tabs.${key}`)}</span>
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
            {!data ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {loadFailed ? t("aiCoach.errorGeneric") : t("common.loading")}
              </div>
            ) : (
              <>
              {/* Kept mounted (just hidden) on other tabs so an in-progress
                  conversation survives a peek at Summary/Analyze. */}
              <div className={cn("flex min-h-0 flex-1 flex-col", tab !== "chat" && "hidden")}>
                <AICoachChat variant="overlay" displayName={data.displayName} historyEnabled={data.historyEnabled} />
              </div>
              {tab === "chat" ? null : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
                {tab === "summary" ? (
                  <>
                    <FinancialSnapshotStrip snapshot={data.snapshot} />
                    <MonthlyHealthCheckCard health={data.healthCheck} showPriorityAction={false} />
                  </>
                ) : tab === "analyze" ? (
                  <>
                    <NextBestActionCard priority={data.priority} />
                    {data.insights.length > 0 ? (
                      <InsightCards insights={data.insights} />
                    ) : (
                      <p className="py-6 text-center text-sm text-muted-foreground">{t("aiCoach.analyzeTabEmpty")}</p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col divide-y rounded-xl border">
                    {TOOLS_TAB_LINKS.map(({ key, href, icon: Icon }) => (
                      <Link
                        key={key}
                        href={href}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center gap-3 px-3 py-3 text-sm font-medium hover:bg-accent/50"
                      >
                        <Icon className="size-4 text-primary" aria-hidden="true" />
                        {t(`aiCoach.toolsTab.${key}`)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              )}
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
