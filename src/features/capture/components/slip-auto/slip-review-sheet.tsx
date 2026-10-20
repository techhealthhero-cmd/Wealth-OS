"use client";

import { useState } from "react";
import { Check, ChevronDown, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { slipCopy } from "./copy";
import { formatBaht } from "./format";
import type { SlipReviewItemVM, SlipReviewViewModel } from "./types";

export interface SlipReviewSheetProps {
  vm: SlipReviewViewModel;
  onAnswer: (itemId: string, answerId: string) => void;
  onChangeCategory: (itemId: string, categoryId: string) => void;
  onSaveAll: () => void;
  /** Disables the save bar while a save is in flight. */
  saving?: boolean;
}

/**
 * Number of rows the save bar will write: every ready row plus every question
 * (an unanswered one is counted as an expense until answered). Pure count —
 * no money math.
 */
export function slipSaveCount(vm: Pick<SlipReviewViewModel, "ready" | "questions">): number {
  return vm.ready.length + vm.questions.length;
}

function SectionCaption({ dot, title, aside }: { dot: string; title: string; aside?: string }) {
  return (
    <div className="mt-[18px] mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: dot }} aria-hidden="true" />
      <b className="text-base font-bold text-foreground">{title}</b>
      {aside ? <span className="ml-auto text-xs font-normal">{aside}</span> : null}
    </div>
  );
}

function ReadyRow({
  item,
  categories,
  onChangeCategory,
}: {
  item: SlipReviewItemVM;
  categories: SlipReviewViewModel["categories"];
  onChangeCategory: SlipReviewSheetProps["onChangeCategory"];
}) {
  const [editing, setEditing] = useState(false);
  const isIncome = item.direction === "income";
  const options = categories.filter((cat) => cat.direction === item.direction);
  const confidence = Math.max(0, Math.min(1, item.confidence));
  return (
    <li className="border-t border-dashed border-[#46648c]/20 first:border-t-0">
      <div className="grid min-h-[62px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 py-1.5">
        <CategoryIcon icon={item.icon} tone={isIncome ? "income" : "default"} />
        <div className="min-w-0">
          <div className="truncate text-[14.5px] leading-[19px] font-semibold">{item.title}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="text-[11.5px] whitespace-nowrap text-muted-foreground">{item.dateLabel}</span>
            <button
              type="button"
              data-testid="slip-category-chip"
              aria-expanded={editing}
              aria-label={`${slipCopy.review.changeCategory}: ${item.categoryLabel}`}
              onClick={() => setEditing((v) => !v)}
              className="-my-2.5 inline-flex min-h-11 min-w-0 items-center"
            >
              <span className="inline-flex h-[26px] min-w-0 items-center gap-1 rounded-full bg-[#2f8a5b]/12 px-2.5 text-xs font-semibold whitespace-nowrap text-[#173b30]">
                <span className="truncate">{item.categoryLabel}</span>
                <ChevronDown className={cn("size-[11px] shrink-0 text-[#8a8574] transition-transform", editing && "rotate-180")} strokeWidth={2.4} aria-hidden="true" />
              </span>
            </button>
            <span
              role="img"
              aria-label="ความมั่นใจ"
              className="h-1 w-[18px] shrink-0 overflow-hidden rounded-sm bg-[#204d3d]/18"
            >
              <i
                className={cn("block h-full", confidence >= 0.9 ? "bg-[#2f8a5b]" : "bg-[#c9a15a]")}
                style={{ width: `${Math.round(confidence * 100)}%` }}
              />
            </span>
          </div>
        </div>
        <span
          className={cn(
            "text-[15.5px] font-bold whitespace-nowrap tabular-nums",
            isIncome ? "text-[#2f8a5b]" : "text-[#b23a3a]"
          )}
        >
          {formatBaht(item.amountCents, isIncome ? "+" : "−")}
        </span>
      </div>
      {editing ? (
        <div className="flex flex-wrap gap-2 pb-2.5 pl-[46px]">
          {options.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onChangeCategory(item.id, cat.id);
                setEditing(false);
              }}
              aria-pressed={cat.id === item.categoryId}
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-[1.5px] px-3.5 text-sm font-medium whitespace-nowrap",
                cat.id === item.categoryId ? "border-[#2f8a5b] bg-[#2f8a5b]/12" : "border-border bg-white"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Step 3 — review. Full-screen overlay: summary, then the few questions
 * (asked first, one answer each), then compact ready rows, duplicates folded
 * into one line, and a fixed save bar above the safe area.
 */
export function SlipReviewSheet({ vm, onAnswer, onChangeCategory, onSaveAll, saving }: SlipReviewSheetProps) {
  const c = slipCopy.review;
  const saveCount = slipSaveCount(vm);
  const dup = vm.duplicates;
  return (
    <div className="fixed inset-0 z-50 bg-background" data-testid="slip-review">
      <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12.5px] leading-4 text-muted-foreground">{c.eyebrow}</p>
              <h1 className="text-xl leading-[26px] font-bold whitespace-nowrap">{c.found(vm.foundCount)}</h1>
            </div>
            <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-2.5 text-[11.5px] font-medium whitespace-nowrap text-[#204d3d]">
              <Smartphone className="size-3" aria-hidden="true" />
              {c.local}
            </span>
          </div>

          <section className="mt-3 rounded-[22px] border border-border bg-card px-3.5 py-3 shadow-card">
            <p className="text-[13px] text-muted-foreground">
              {vm.monthLabel}
              {dup.length > 0 ? ` · ${c.dupSkipped(dup.length)}` : ""}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-2xl bg-[#fbeeea] px-3 py-2">
                <small className="block text-[11.5px] text-muted-foreground">{c.expense(vm.expense.count)}</small>
                <b className="block text-lg leading-[1.3] font-bold whitespace-nowrap text-[#a4574a] tabular-nums">
                  {formatBaht(vm.expense.totalCents)}
                </b>
              </div>
              <div className="min-w-0 rounded-2xl bg-[#eef8f1] px-3 py-2">
                <small className="block text-[11.5px] text-muted-foreground">{c.income(vm.income.count)}</small>
                <b className="block text-lg leading-[1.3] font-bold whitespace-nowrap text-[#204d3d] tabular-nums">
                  {formatBaht(vm.income.totalCents, "+")}
                </b>
              </div>
            </div>
          </section>

          {vm.questions.length > 0 ? (
            <section aria-label={c.ask(vm.questions.length)}>
              <SectionCaption dot="#c9a15a" title={c.ask(vm.questions.length)} />
              <div className="space-y-2.5">
                {vm.questions.map((q) => (
                  <div key={q.id} className="rounded-[20px] border-[1.5px] border-dashed border-[#c9a15a] bg-card px-3.5 py-3">
                    <h3 className="text-base leading-[23px] font-semibold">
                      {q.verb}{" "}
                      <em className="font-bold whitespace-nowrap text-[#b23a3a] not-italic tabular-nums">
                        {formatBaht(q.amountCents)}
                      </em>{" "}
                      {q.whoLabel} {c.questionTail}
                    </h3>
                    <p className="mt-px text-xs leading-[17px] text-muted-foreground">{q.context}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {q.options.map((o) => {
                        const selected = q.answeredOptionId === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            data-testid="slip-answer-chip"
                            aria-pressed={selected}
                            onClick={() => onAnswer(q.id, o.id)}
                            className={cn(
                              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-[1.5px] px-3.5 text-sm font-medium whitespace-nowrap shadow-[0_4px_8px_-6px_rgba(60,45,20,0.35)]",
                              selected ? "border-[#2f8a5b] bg-[#2f8a5b]/12" : "border-border bg-white"
                            )}
                          >
                            {selected ? <Check className="mr-1 size-4 text-[#2f8a5b]" strokeWidth={3} aria-hidden="true" /> : null}
                            {o.label}
                            {o.hint ? <small className="ml-1.5 text-[11px] font-normal text-muted-foreground">{o.hint}</small> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {vm.ready.length > 0 ? (
            <section aria-label={c.ready(vm.ready.length)}>
              <SectionCaption dot="#2f8a5b" title={c.ready(vm.ready.length)} aside={c.tapToEdit} />
              <ul className="rounded-[22px] border border-border bg-card px-3.5 py-0.5 shadow-card">
                {vm.ready.map((item) => (
                  <ReadyRow key={item.id} item={item} categories={vm.categories} onChangeCategory={onChangeCategory} />
                ))}
              </ul>
            </section>
          ) : null}

          {dup.length > 0 ? (
            <details className="group mt-3 rounded-2xl border border-dashed border-[#cdbf9e] bg-card/70">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[13px] text-muted-foreground [&::-webkit-details-marker]:hidden">
                <Check className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold text-foreground">{c.dupLabel(dup.length)}</b> · {dup[0].title}{" "}
                  {formatBaht(dup[0].amountCents)} · {dup[0].dateLabel} {c.dupSkippedShort}
                </span>
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="space-y-1 px-3.5 pb-2.5 text-[12.5px] leading-[18px] text-muted-foreground">
                <li>{c.dupBody}</li>
                {dup.map((d) => (
                  <li key={d.id} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {d.title} · {d.dateLabel}
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatBaht(d.amountCents, d.direction === "income" ? "+" : "−")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>

      <div
        data-testid="slip-save-bar"
        className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-[#f7efdf] px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center shadow-[0_-10px_16px_-10px_rgba(60,45,20,0.3)] before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-gradient-to-t before:from-[#f7efdf] before:to-transparent before:content-['']"
      >
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={onSaveAll}
            disabled={saving || saveCount === 0}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#2f8a5b] text-lg font-bold whitespace-nowrap text-white shadow-[0_8px_14px_-5px_rgba(47,138,91,0.5)] disabled:opacity-60"
          >
            <Check className="size-[22px]" aria-hidden="true" />
            {c.saveAll(saveCount)}
          </button>
          <small className="mt-1.5 block text-[11.5px] leading-[15px] text-muted-foreground">{c.saveNote}</small>
        </div>
      </div>
    </div>
  );
}
