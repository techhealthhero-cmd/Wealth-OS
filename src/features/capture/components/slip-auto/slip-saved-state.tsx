import { Check, ChevronRight, ScanLine, Undo2 } from "lucide-react";

import { slipCopy } from "./copy";
import { formatBaht } from "./format";
import { categoryColor, type SlipSavedViewModel } from "./types";

export interface SlipSavedStateProps {
  vm: SlipSavedViewModel;
  /** TODO(codex-wiring): undo the whole batch (one client_request_id per batch). */
  onUndo: () => void;
  onViewMonth: () => void;
  onBackHome: () => void;
  onScanMore: () => void;
}

/** Step 4 — gold "saved" stamp, undo toast and a month teaser. */
export function SlipSavedState({ vm, onUndo, onViewMonth, onBackHome, onScanMore }: SlipSavedStateProps) {
  const c = slipCopy.saved;
  return (
    <div className="mx-auto w-full max-w-lg pb-6" data-testid="slip-saved">
      <div className="relative grid h-[210px] place-items-center">
        <div className="flex -rotate-6 items-center gap-2 rounded-[14px] border-[3.5px] border-double border-[#a8833f] bg-[#c9a15a]/10 py-2.5 pr-[18px] pl-3.5 text-[22px] leading-7 font-bold whitespace-nowrap text-[#a8833f] mix-blend-multiply">
          <Check className="size-7" strokeWidth={3} aria-hidden="true" />
          {c.stamp(vm.savedCount)}
        </div>
      </div>
      <p className="px-6 text-center text-[15px] font-medium">{c.done}</p>
      <p className="px-6 pt-0.5 pb-3.5 text-center text-[12.5px] text-muted-foreground">
        {vm.duplicateCount > 0 ? c.dupNote(vm.duplicateCount) : c.noDupNote}
      </p>

      <div
        role="status"
        className="mx-4 flex min-h-[52px] items-center justify-between gap-2.5 rounded-full bg-[#173b30] py-1 pr-2 pl-[18px] text-sm text-white shadow-[0_10px_18px_-8px_rgba(23,59,48,0.6)]"
      >
        <span className="min-w-0 truncate">{c.toast(vm.savedCount)}</span>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white/15 px-[18px] font-semibold text-[#ffe9b8]"
        >
          <Undo2 className="mr-1.5 size-4" aria-hidden="true" />
          {c.undo}
        </button>
      </div>

      <section className="mx-4 mt-[18px] rounded-[22px] border border-border bg-card p-4 shadow-card">
        <p className="text-[13px] text-muted-foreground">{vm.monthLabel}</p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{c.spent}</p>
        <p className="text-[34px] leading-[1.2] font-bold tracking-tight whitespace-nowrap text-[#a4574a] tabular-nums">
          {formatBaht(vm.monthSpentCents)}
        </p>
        <p className="mt-2">
          <span className="inline-flex items-center rounded-[14px] bg-[#fbeeea] px-[11px] py-1 text-[13px] font-semibold whitespace-nowrap text-[#a4574a] tabular-nums">
            {formatBaht(vm.batchSpentCents, "+")} {c.fromBatch}
          </span>
        </p>
        {vm.segments.length > 0 ? (
          <div className="mt-3 flex h-5 gap-0.5 overflow-hidden rounded-[10px]" aria-hidden="true">
            {vm.segments.map((s, i) => (
              <i key={s.id} className="block h-full" style={{ width: `${s.percent}%`, background: categoryColor(s, i) }} />
            ))}
          </div>
        ) : null}
        <p className="mt-2.5 text-sm font-semibold whitespace-nowrap text-[#2f8a5b] tabular-nums">
          {slipCopy.month.income} {formatBaht(vm.monthIncomeCents)} · {slipCopy.month.left} {formatBaht(vm.monthLeftCents)}
        </p>
        <button
          type="button"
          onClick={onViewMonth}
          className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#204d3d]"
        >
          {c.viewWhere}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-2.5 px-4">
        <button
          type="button"
          onClick={onBackHome}
          className="flex h-[52px] items-center justify-center rounded-full border-[1.5px] border-[#c9b88f] bg-[#fffbf2]/70 text-[15.5px] font-semibold whitespace-nowrap text-[#204d3d]"
        >
          {c.backHome}
        </button>
        <button
          type="button"
          onClick={onScanMore}
          className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-[#2f8a5b] text-[15.5px] font-semibold whitespace-nowrap text-white shadow-[0_8px_14px_-5px_rgba(47,138,91,0.5)]"
        >
          <ScanLine className="size-5" aria-hidden="true" />
          {c.scanMore}
        </button>
      </div>
    </div>
  );
}
