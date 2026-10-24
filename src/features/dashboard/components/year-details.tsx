import Link from "next/link";

import { CategoryIcon } from "@/components/shared/category-icon";
import { formatMoney } from "@/lib/financial/money";
import {
  groupTopCategories,
  type CategoryChange,
  type CategoryComparisonRow,
  type MonthlyNetPoint,
} from "@/lib/financial/month-details";
import { cn } from "@/lib/utils";

/**
 * The two sections picked from mockups v2/v4 (2026-10-25) for the Home
 * yearly card's "View details": left-over per month for this year, and
 * this month's spending by category against the same days of last month.
 * Presentation only — every figure arrives precomputed from
 * src/lib/financial/month-details.ts.
 */

const SAVED = "#8FD1AE";
const SHORT = "#E8A7B3";
const BARS_HEIGHT_PX = 96;
const LABEL_SPACE_PX = 16;

/**
 * "4.2k" / "23k" / "−600" — short enough to sit over a bar twelve to a row
 * on a 375px phone. Colour already says left over vs short, so positives
 * drop the "+", and from 10k up the decimal goes.
 */
function compactBaht(cents: number) {
  const baht = Math.abs(cents) / 100;
  const k = baht / 1000;
  const text =
    baht >= 10_000 ? `${Math.round(k)}k` : baht >= 1000 ? `${k.toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(baht));
  return `${cents < 0 ? "−" : ""}${text}`;
}

export function MonthlyNetBars({
  points,
  monthLabels,
  currencyCode,
  labels,
}: {
  points: MonthlyNetPoint[];
  /** 12 short month names, January first. */
  monthLabels: string[];
  currencyCode: string;
  labels: {
    title: string;
    hint: string;
    saved: string;
    short: string;
    inProgress: string;
    future: string;
    noData: string;
  };
}) {
  const withData = points.filter((p) => p.state === "data");
  const maxUp = Math.max(0, ...withData.map((p) => p.netCents));
  const maxDown = Math.max(0, ...withData.map((p) => -p.netCents));
  const scale = maxUp + maxDown || 1;
  const upHeight = maxUp > 0 ? (maxUp / scale) * BARS_HEIGHT_PX + LABEL_SPACE_PX : LABEL_SPACE_PX;
  const downHeight = maxDown > 0 ? (maxDown / scale) * BARS_HEIGHT_PX + LABEL_SPACE_PX : 8;
  const barPx = (cents: number) => Math.max(4, (Math.abs(cents) / scale) * BARS_HEIGHT_PX);
  const current = points.find((p) => p.isCurrentMonth);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{labels.title}</p>
        <span className="text-[11px] text-muted-foreground">{labels.hint}</span>
      </div>

      <ul className="sr-only">
        {withData.map((p) => (
          <li key={p.monthIndex}>
            {monthLabels[p.monthIndex]}: {formatMoney(p.netCents, currencyCode, undefined, 0)}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-12 gap-1 pt-1" aria-hidden="true">
        {points.map((p) => {
          const up = p.state === "data" && p.netCents >= 0;
          const down = p.state === "data" && p.netCents < 0;
          const hatch = p.isCurrentMonth
            ? "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.55)_0_3px,transparent_3px_6px)]"
            : undefined;
          return (
            <div key={p.monthIndex} className="flex min-w-0 flex-col items-center">
              <div className="flex w-full flex-col items-center justify-end" style={{ height: upHeight }}>
                {up ? (
                  <>
                    <span className="whitespace-nowrap text-[9px] font-semibold tracking-tight tabular-nums text-[#2F7A5A] dark:text-emerald-300">
                      {compactBaht(p.netCents)}
                    </span>
                    <span
                      className={cn("w-full max-w-5 rounded-md", hatch)}
                      style={{ height: barPx(p.netCents), backgroundColor: SAVED }}
                    />
                  </>
                ) : p.state === "future" ? (
                  <span className="mb-0.5 h-4 w-full max-w-5 rounded-md border-[1.5px] border-dashed border-border" />
                ) : null}
              </div>
              <div className="flex h-px w-[calc(100%+0.25rem)] items-center bg-border">
                {p.state === "empty" ? <span className="mx-auto h-1 w-full max-w-5 rounded-full bg-muted" /> : null}
              </div>
              <div className="flex w-full flex-col items-center" style={{ height: downHeight }}>
                {down ? (
                  <>
                    <span
                      className={cn("w-full max-w-5 rounded-md", hatch)}
                      style={{ height: barPx(p.netCents), backgroundColor: SHORT }}
                    />
                    <span className="whitespace-nowrap text-[9px] font-semibold tracking-tight tabular-nums text-[#B23A48] dark:text-rose-300">
                      {compactBaht(p.netCents)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-1" aria-hidden="true">
        {monthLabels.map((label, i) => (
          <span
            key={label}
            className={cn(
              "truncate text-center text-[9.5px] text-muted-foreground",
              points[i]?.isCurrentMonth && "font-bold text-foreground"
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {withData.length === 0 ? <p className="text-xs text-muted-foreground">{labels.noData}</p> : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <LegendSwatch color={SAVED} label={labels.saved} />
        <LegendSwatch color={SHORT} label={labels.short} />
        {current?.state === "data" ? <LegendSwatch color={SAVED} hatched label={labels.inProgress} /> : null}
        {points.some((p) => p.state === "future") ? <LegendSwatch dashed label={labels.future} /> : null}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, hatched, dashed }: { color?: string; label: string; hatched?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-block size-2.5 rounded-[3px]",
          hatched && "bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.6)_0_2px,transparent_2px_4px)]",
          dashed && "border border-dashed border-muted-foreground/60"
        )}
        style={color ? { backgroundColor: color } : undefined}
      />
      {label}
    </span>
  );
}

// Six shades: up to MAX_ROWS rows plus one unfolded leftover (see groupTopCategories).
const CATEGORY_COLORS = ["#2F6B52", "#5F9A7F", "#8FBFA6", "#B9D8C6", "#D6E6DC", "#E3DCCB"];
const REST_COLOR = "#E3DCCB";
const MAX_ROWS = 5;

export type CategoryComparisonItem = CategoryComparisonRow & {
  categoryNameEn: string | null;
  categoryNameTh: string | null;
  categoryIcon: string | null;
};

export function CategorySpendingList({
  rows,
  locale,
  currencyCode,
  showComparison,
  transactionsHref,
  labels,
}: {
  rows: CategoryComparisonItem[];
  locale: "th" | "en";
  currencyCode: string;
  /** False when last month has nothing to compare against — chips and caption are hidden. */
  showComparison: boolean;
  transactionsHref: string;
  labels: {
    title: string;
    total: string;
    compareCaption: string;
    same: string;
    isNew: string;
    other: string;
    uncategorized: string;
    noSpending: string;
    viewAll: string;
  };
}) {
  const whole = (cents: number) => formatMoney(cents, currencyCode, undefined, 0);
  const total = rows.reduce((sum, row) => sum + row.totalCents, 0);
  const { top, rest } = groupTopCategories(rows, MAX_ROWS);

  const items = [
    ...top.map((row, i) => ({
      key: row.categoryId ?? "uncategorized",
      name: (locale === "th" ? row.categoryNameTh : row.categoryNameEn) ?? labels.uncategorized,
      icon: row.categoryIcon,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      row,
    })),
    ...(rest
      ? [{ key: "rest", name: labels.other.replace("{count}", String(rest.count)), icon: null, color: REST_COLOR, row: rest }]
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{labels.title}</p>
        {total > 0 ? (
          <span className="text-[11px] text-muted-foreground tabular-nums">{labels.total.replace("{amount}", whole(total))}</span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground">{labels.noSpending}</p>
      ) : (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {items.map((item) => (
              <span key={item.key} className="h-full" style={{ flex: item.row.totalCents, backgroundColor: item.color }} />
            ))}
          </div>
          {showComparison ? <p className="text-[11px] text-muted-foreground">{labels.compareCaption}</p> : null}

          <ul className="divide-y divide-dashed">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2.5 py-2">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <CategoryIcon icon={item.icon} className="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span className="block text-[11px] text-muted-foreground tabular-nums">{item.row.sharePercent.toFixed(0)}%</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{whole(item.row.totalCents)}</span>
                {showComparison ? (
                  <ChangeChip change={item.row.change} deltaCents={item.row.deltaCents} format={whole} labels={labels} />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href={transactionsHref}
        className="flex min-h-11 items-center justify-center rounded-xl bg-muted/70 text-xs font-semibold text-primary transition-transform duration-(--motion-fast) active:scale-[0.98]"
      >
        {labels.viewAll}
      </Link>
    </div>
  );
}

function ChangeChip({
  change,
  deltaCents,
  format,
  labels,
}: {
  change: CategoryChange;
  deltaCents: number;
  format: (cents: number) => string;
  labels: { same: string; isNew: string };
}) {
  const text =
    change === "more" ? `↑ ${format(deltaCents)}` : change === "less" ? `↓ ${format(-deltaCents)}` : change === "same" ? labels.same : labels.isNew;
  return (
    <span
      className={cn(
        "min-w-[4.75rem] shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums",
        change === "more" && "bg-rose-50 text-[#B23A48] dark:bg-rose-500/15 dark:text-rose-300",
        change === "less" && "bg-emerald-50 text-[#2F7A5A] dark:bg-emerald-500/15 dark:text-emerald-300",
        (change === "same" || change === "new") && "bg-muted text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}
