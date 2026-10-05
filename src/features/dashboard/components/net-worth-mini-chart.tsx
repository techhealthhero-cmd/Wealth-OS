"use client";

import { useId, useMemo, useRef, useState } from "react";

import { formatMoney } from "@/lib/financial/money";

interface NetWorthMiniChartPoint {
  date: string;
  netWorth: number;
}

interface NetWorthMiniChartProps {
  data: NetWorthMiniChartPoint[];
  tone: "highlight" | "default";
}

// Must match the LineChart's left/right margin below â€” the point scale
// spans exactly the plot area between them.
const CHART_MARGIN_X = 2;

/**
 * Maps a pointer's clientX to the nearest data index, clamped to the first/
 * last point â€” so a finger dragged past either edge of the chart keeps the
 * tooltip pinned to that end instead of freezing mid-chart.
 */
export function scrubIndexFromClientX(
  clientX: number,
  rect: { left: number; width: number },
  pointCount: number
): number {
  if (pointCount <= 1) return 0;
  const plotWidth = rect.width - CHART_MARGIN_X * 2;
  if (plotWidth <= 0) return 0;
  const ratio = (clientX - rect.left - CHART_MARGIN_X) / plotWidth;
  const index = Math.round(ratio * (pointCount - 1));
  return Math.min(pointCount - 1, Math.max(0, index));
}

/**
 * Compact sparkline for the dashboard hero card â€” deliberately no axes/grid,
 * just the shape of the trend, so it reads in one glance rather than
 * competing with the headline number for attention. The full labeled chart
 * with axis/tooltip detail already exists at /money/net-worth
 * (net-worth-view.tsx); this is not a replacement, just a teaser.
 *
 * Requested (2026-10-03): scrubbing left/right must keep working after the
 * finger leaves the chart box. Recharts drops touch moves outside its plot
 * area (the tooltip freezes), and its own pointer state overrides any
 * index passed in â€” so a transparent overlay owns the pointer instead
 * (pointer capture keeps events flowing outside the box) and drives the
 * Tooltip purely through `active` + `defaultIndex`. `touch-action: pan-y`
 * keeps vertical page scrolling working when the drag starts on the chart.
 */
export function NetWorthMiniChart({ data, tone }: NetWorthMiniChartProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");

  // #7FD6B2 matches the existing hardcoded positive-delta color used on the
  // dark "highlight" card background elsewhere in this component (see
  // net-worth-hero.tsx) â€” var(--color-chart-1) doesn't have enough contrast
  // against that same dark green background.
  const stroke = tone === "highlight" ? "#7FD6B2" : "var(--color-chart-1)";
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const values = data.map((point) => point.netWorth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return data.map((point, index) => ({
      x: data.length === 1 ? 50 : (index / (data.length - 1)) * 100,
      y: 58 - ((point.netWorth - min) / range) * 52,
    }));
  }, [data]);
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length > 0 ? `M ${points[0].x} 64 L ${polyline.replaceAll(",", " ")} L ${points.at(-1)!.x} 64 Z` : "";
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const activeCoordinate = activeIndex === null ? null : points[activeIndex];

  // Where the current press started, to tell a drag apart from a tap.
  const pressStartXRef = useRef<number | null>(null);
  const draggedRef = useRef(false);

  /**
   * Reported (2026-10-03): releasing a drag OUTSIDE the chart navigated to
   * the transactions page â€” the browser fires the post-touch click at
   * whatever is under the finger on release (a linked card below the hero).
   * After a real drag, swallow exactly that one click in the capture phase,
   * before any link/router handler sees it. Taps (no movement) are untouched.
   */
  function suppressNextClick() {
    const block = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("click", block, true);
      window.clearTimeout(timer);
    };
    window.addEventListener("click", block, true);
    // The synthetic click follows touchend almost immediately; never leave
    // the guard armed long enough to eat a later, intentional tap.
    const timer = window.setTimeout(cleanup, 400);
  }

  function updateFromPointer(clientX: number) {
    const el = overlayRef.current;
    if (!el) return;
    setActiveIndex(scrubIndexFromClientX(clientX, el.getBoundingClientRect(), data.length));
  }

  return (
    <div className="relative h-16">
      <svg aria-hidden="true" className="size-full overflow-visible" viewBox="0 0 100 64" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        <polyline points={polyline} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {activeCoordinate ? (
          <>
            <line
              x1={activeCoordinate.x}
              x2={activeCoordinate.x}
              y1="0"
              y2="64"
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={activeCoordinate.x} cy={activeCoordinate.y} r="2.5" fill={stroke} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </svg>
      {activePoint && activeCoordinate ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: `${activeCoordinate.x}%` }}
        >
          <p className="text-muted-foreground">{activePoint.date}</p>
          <p className="font-medium whitespace-nowrap text-popover-foreground">{formatMoney(activePoint.netWorth)}</p>
        </div>
      ) : null}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="absolute inset-0 touch-pan-y"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pressStartXRef.current = e.clientX;
          draggedRef.current = false;
          updateFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          // Touch: only while the finger is down (captured). Mouse: plain
          // hover also scrubs, matching the previous desktop behavior.
          if (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture(e.pointerId)) {
            updateFromPointer(e.clientX);
          }
          const startX = pressStartXRef.current;
          if (startX !== null && Math.abs(e.clientX - startX) > 6) draggedRef.current = true;
        }}
        onPointerUp={() => {
          if (draggedRef.current) suppressNextClick();
          pressStartXRef.current = null;
          draggedRef.current = false;
        }}
        onPointerCancel={() => {
          pressStartXRef.current = null;
          draggedRef.current = false;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !e.currentTarget.hasPointerCapture(e.pointerId)) {
            setActiveIndex(null);
          }
        }}
      />
    </div>
  );
}
