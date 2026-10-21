import { Bell, Check, LoaderCircle, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { slipCopy } from "./copy";
import { formatBaht } from "./format";
import { SlipGlyph } from "./slip-glyph";
import type { SlipReadingViewModel } from "./types";

export interface SlipReadingProgressProps {
  vm: SlipReadingViewModel;
  /** "ไว้ดูทีหลัง" — keep reading in the background, badge only (no push). */
  onLater: () => void;
}

/** Step 2 — calm progress: thumbnails, "อ่านแล้ว x/y", last few lines. */
export function SlipReadingProgress({ vm, onLater }: SlipReadingProgressProps) {
  const c = slipCopy.reading;
  const pct = vm.total > 0 ? Math.min(100, Math.round((vm.done / vm.total) * 100)) : 0;
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-6" data-testid="slip-reading">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] leading-4 text-muted-foreground">{c.eyebrow}</p>
          <h1 className="text-xl leading-[26px] font-bold">{c.title}</h1>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-2.5 text-[11.5px] font-medium whitespace-nowrap text-[#204d3d]">
          <Smartphone className="size-3" aria-hidden="true" />
          {c.local}
        </span>
      </div>

      <div className="rounded-[22px] border border-border bg-card px-3.5 py-3 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <b className="text-lg whitespace-nowrap tabular-nums">
            {c.read} {vm.done}/{vm.total}
          </b>
          <span className="text-[12.5px] text-muted-foreground">{c.soon}</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={vm.total}
          aria-valuenow={vm.done}
          className="mt-2.5 h-3 overflow-hidden rounded-full bg-[#204d3d]/12"
        >
          <i
            className="block h-full rounded-full bg-gradient-to-r from-[#2f8a5b] to-[#3fa270]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-4 gap-2.5 px-1">
        {vm.thumbs.map((t) => (
          <li key={t.id} className={cn("relative", t.status === "waiting" && "opacity-40")}>
            <SlipGlyph
              tint={t.tint}
              label={t.status === "done" ? t.amountLabel : undefined}
              labelColor={t.direction === "income" ? "#2f8a5b" : undefined}
              className="h-auto w-full drop-shadow-[0_3px_4px_rgba(60,45,20,0.22)]"
            />
            {t.status === "done" ? (
              <span className="absolute -top-1 -right-1 grid size-[22px] place-items-center rounded-full border-2 border-background bg-[#2f8a5b] text-white">
                <Check className="size-3" strokeWidth={3.4} aria-hidden="true" />
                <span className="sr-only">อ่านแล้ว</span>
              </span>
            ) : null}
            {t.status === "reading" ? (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bottom-1.5 rounded-md bg-gradient-to-r from-transparent via-[#fffbf2]/85 to-transparent motion-safe:animate-pulse"
                />
                <LoaderCircle
                  className="absolute top-[42%] left-1/2 -mt-[11px] -ml-[11px] size-[22px] text-[#204d3d] motion-safe:animate-spin"
                  strokeWidth={2.6}
                  aria-label="กำลังอ่าน"
                />
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {vm.recent.length > 0 ? (
        <section>
          <p className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-muted-foreground">
            <span className="size-2 rounded-full bg-[#c9a15a]" aria-hidden="true" />
            {c.recent}
          </p>
          <ul className="rounded-[22px] border border-border bg-card px-3.5 py-1 shadow-card">
            {vm.recent.slice(0, 3).map((r, i) => (
              <li
                key={r.id}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 border-t border-dashed border-[#46648c]/20 text-sm first:border-t-0",
                  i === 1 && "opacity-70",
                  i === 2 && "opacity-45"
                )}
              >
                <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[#2f8a5b] text-white">
                  <Check className="size-3" strokeWidth={3.4} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold">{r.title}</b>{" "}
                  <span className="text-muted-foreground">· {r.categoryLabel}</span>
                </span>
                <span
                  className={cn(
                    "font-semibold whitespace-nowrap tabular-nums",
                    r.direction === "income" ? "text-[#2f8a5b]" : "text-[#b23a3a]"
                  )}
                >
                  {r.direction === "income" ? formatBaht(r.amountCents, "+") : formatBaht(r.amountCents, "−")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="flex items-center justify-center gap-2 px-5 text-[13px] text-muted-foreground">
        <Bell className="size-4 shrink-0" aria-hidden="true" />
        {c.canClose}
      </p>
      <button
        type="button"
        onClick={onLater}
        className="flex h-12 w-full items-center justify-center rounded-full border-[1.5px] border-[#c9b88f] bg-[#fffbf2]/70 text-[15.5px] font-semibold text-[#204d3d]"
      >
        {c.later}
      </button>
      <p className="text-center text-[11.5px] text-muted-foreground">{c.footer}</p>
    </div>
  );
}
