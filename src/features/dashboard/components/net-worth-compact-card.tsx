"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import type { NetWorthChange } from "@/lib/financial/net-worth";
import { formatMoney } from "@/lib/financial/money";

export interface NetWorthCompactCardProps {
  labels: {
    label: string;
    details: string;
    /** Contains {amount}. */
    thisYearUp: string;
    /** Contains {amount}. */
    thisYearDown: string;
    thisYearSame: string;
    /** Contains {month} and {amount}. */
    sinceUp: string;
    /** Contains {month} and {amount}. */
    sinceDown: string;
    /** Contains {month}. */
    sinceSame: string;
    noHistoryYet: string;
    /** Contains {month} and {amount}. */
    monthSpent: string;
    /** Screen-reader name of the link target. */
    viewAssetsAndLiabilities: string;
  };
  netWorthCents: number;
  /**
   * Change against a real snapshot. `year` is a baseline on or just before
   * 1 Jan. `since` is a later first snapshot and must not be called "this year".
   */
  delta: { scope: "year" | "since"; monthLabel: string; change: NetWorthChange } | null;
  /** This calendar month's expenses. Null when unknown or zero. */
  monthSpend: { monthLabel: string; cents: number } | null;
  currencyCode?: string;
  /** Profile display name, printed as the card's bottom-right mark. */
  displayName?: string | null;
}

/** Champagne-gold face. Always this metal, in light and dark. */
const GOLD_FACE =
  "linear-gradient(125deg,#fbefc8 0%,#e2bf70 40%,#f8e6ad 62%,#c39a50 100%)";

/** Dark-green card sitting behind the gold one. */
const GREEN_BACK =
  "linear-gradient(125deg,#4d7a62 0%,#1c3226 42%,#36584a 62%,#132219 100%)";

/** Splits "−฿254,326" + ".35" on the formatted string. No money math. */
function splitFigure(formatted: string): { main: string; decimal: string } {
  const match = /^(.*\d)([.,]\d{2}\D*)$/.exec(formatted);
  return match ? { main: match[1], decimal: match[2] } : { main: formatted, decimal: "" };
}

function wholeOrCents(cents: number, currencyCode: string | undefined): string {
  return formatMoney(Math.abs(cents), currencyCode, currencyCode === "THB" ? "th-TH" : undefined, cents % 100 === 0 ? 0 : 2);
}

/**
 * Font size that keeps the figure on one line. `100cqi` is the text column.
 * Each full-size glyph is ~0.66em in this face; satang is 0.6em, so those
 * three characters count as less. Capped at 40px so short balances stay
 * the mockup size instead of stretching.
 */
function figureFontSize(formatted: string, hasDecimal: boolean): string {
  const ems = (hasDecimal ? formatted.length - 1.2 : formatted.length) * 0.66;
  return `min(40px, calc(100cqi / ${ems.toFixed(2)}))`;
}

/**
 * Shrinks the figure until it fits the card. The CSS size is the first
 * paint (and the no-JS fallback); measurement corrects long balances
 * before the browser paints.
 */
function FittedFigure({
  main,
  decimal,
  fontSize,
}: {
  main: string;
  decimal: string;
  fontSize: string;
}) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const fit = () => {
      const available = outer.clientWidth;
      if (available <= 0) return;
      inner.style.fontSize = "40px";
      const needed = inner.scrollWidth;
      const next = needed <= available + 1 ? 40 : Math.max(15, Math.floor((40 * available) / needed));
      inner.style.fontSize = `${next}px`;
      setPx((current) => (current === next ? current : next));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [main, decimal]);

  return (
    <span ref={outerRef} className="block w-full min-w-0" style={{ containerType: "inline-size" }}>
      <span
        ref={innerRef}
        data-testid="home-net-worth-figure"
        className="block w-max max-w-full font-semibold whitespace-nowrap text-[#1f3a2c] tabular-nums"
        style={{ fontSize: px == null ? fontSize : `${px}px`, letterSpacing: "-1px", lineHeight: 1 }}
      >
        {main}
        {decimal ? <span className="text-[0.6em] opacity-60">{decimal}</span> : null}
      </span>
    </span>
  );
}

/**
 * Home net worth. A champagne-gold bank card (silver chip, brand mark,
 * display name) with a dark-green card peeking out behind it. The whole
 * card opens /money/net-worth. The figure stays dark green even when the
 * balance is negative, and shrinks instead of wrapping.
 */
export function NetWorthCompactCard({
  labels,
  netWorthCents,
  delta,
  monthSpend,
  currencyCode,
  displayName,
}: NetWorthCompactCardProps) {
  const changeCents = delta?.change.changeCents ?? 0;
  const amount = wholeOrCents(changeCents, currencyCode);
  let deltaText: string | null = null;
  if (delta) {
    if (changeCents === 0) {
      deltaText = delta.scope === "year" ? labels.thisYearSame : labels.sinceSame.replace("{month}", delta.monthLabel);
    } else if (delta.scope === "year") {
      deltaText = (changeCents > 0 ? labels.thisYearUp : labels.thisYearDown).replace("{amount}", amount);
    } else {
      deltaText = (changeCents > 0 ? labels.sinceUp : labels.sinceDown)
        .replace("{month}", delta.monthLabel)
        .replace("{amount}", amount);
    }
  }
  const monthText = monthSpend
    ? labels.monthSpent.replace("{month}", monthSpend.monthLabel).replace("{amount}", wholeOrCents(monthSpend.cents, currencyCode))
    : null;
  const formatted = formatMoney(
    netWorthCents,
    currencyCode,
    currencyCode === "THB" ? "th-TH" : undefined,
    netWorthCents % 100 === 0 ? 0 : 2,
  );
  const { main, decimal } = splitFigure(formatted);
  const mark = displayName?.trim() ? displayName.trim().toLocaleUpperCase("en-US") : null;
  const arrow = changeCents > 0 ? "↗" : changeCents < 0 ? "↘" : null;

  return (
    <section aria-label={labels.label} data-testid="home-net-worth" className="relative mx-auto h-[242px] max-w-[420px] px-1">
      <Link
        href="/money/net-worth"
        className="absolute inset-x-1 top-4 bottom-0 block rounded-[20px] [perspective:900px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:opacity-95"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[20px] opacity-90 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.3)] [transform:rotateX(4deg)_rotateZ(3deg)_translate(8px,-14px)_scale(0.97)] motion-reduce:[transform:rotate(2.5deg)_translate(6px,-10px)_scale(0.97)]"
          style={{ background: GREEN_BACK }}
        />
        <span
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[20px] border border-white/60 px-[22px] pt-[22px] pb-5 text-[#3a2e14] shadow-[0_26px_34px_-16px_rgba(20,40,30,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] [transform:rotateX(4deg)] motion-reduce:transform-none"
          style={{ background: GOLD_FACE }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(95deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px),radial-gradient(circle at 85% 0%,rgba(255,255,255,.25),transparent 45%)",
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[-60%] left-[-30%] h-[220%] w-[60%] rotate-[25deg]"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)" }}
          />
          <span className="relative flex items-center justify-between gap-3 text-xs tracking-[2px]">
            <span>{labels.label}</span>
            <span className="shrink-0">WEALTH OS</span>
          </span>
          <span
            aria-hidden="true"
            className="relative mt-[18px] mb-3 h-8 w-[42px] shrink-0 rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
            style={{ background: "linear-gradient(135deg,#e2e4de,#9aa09a 60%,#f2f3ee)" }}
          />
          <span className="relative block min-w-0">
            <FittedFigure main={main} decimal={decimal} fontSize={figureFontSize(formatted, decimal.length > 0)} />
          </span>
          {deltaText || monthText ? (
            <span className="relative mt-2 flex max-w-[92%] flex-wrap items-baseline gap-x-1.5 text-xs leading-5 text-[#3a2e14]/85">
              {deltaText ? (
                <span>
                  {arrow ? <span aria-hidden="true">{arrow} </span> : null}
                  {deltaText}
                </span>
              ) : null}
              {deltaText && monthText ? (
                <span aria-hidden="true" className="opacity-60">
                  ·
                </span>
              ) : null}
              {monthText ? <span>{monthText}</span> : null}
            </span>
          ) : (
            <span className="relative mt-2 block max-w-[92%] text-xs leading-5 text-[#3a2e14]/85">{labels.noHistoryYet}</span>
          )}
          {mark ? (
            <span className="absolute right-[22px] bottom-5 max-w-[46%] truncate text-xs font-bold tracking-wide text-[#1f3a2c]">
              {mark}
            </span>
          ) : null}
          <span className="sr-only">{labels.viewAssetsAndLiabilities}</span>
        </span>
      </Link>
    </section>
  );
}
