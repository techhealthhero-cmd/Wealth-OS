"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Account, Category } from "@/types/database";
import type { CaptureDraft } from "@/lib/capture/draft";
import type { UnsureAnswer } from "@/lib/capture/capture-device-store";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { buildUnsureQuestion } from "@/lib/capture/unsure-answer";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/client";
import { ConfidenceBadge } from "./confidence-badge";
import { Pencil } from "lucide-react";

export const UNSURE_CHOICES = [
  { value: "expense", label: "ค่าใช้จ่าย" },
  { value: "lend", label: "ให้ยืม (ทวงคืนได้)" },
  { value: "wage", label: "จ่ายค่าจ้างงาน" },
] as const;

export function CaptureSaveButton({ onSave, disabled, saving, largeText, pending, children }: {
  onSave: () => void; disabled: boolean; saving: boolean;
  largeText?: boolean; pending?: boolean; children?: ReactNode;
}) {
  return (
    <button type="button" data-testid="capture-save" aria-label={pending ? "บันทึกไว้ก่อน ถามทีหลัง" : "บันทึก"}
      onClick={onSave} disabled={disabled}
      className={cn("w-full shrink-0 rounded-2xl bg-primary px-4 text-lg font-semibold text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", largeText ? "min-h-[72px]! text-2xl" : "min-h-14!")}>
      {saving ? "กำลังบันทึก…" : pending ? "บันทึกไว้ก่อน ถามทีหลัง" : children ?? "บันทึก"}
    </button>
  );
}

export function CaptureUnsureQuestion({ draft, onAnswer }: { draft: CaptureDraft; onAnswer: (answer: UnsureAnswer) => void }) {
  return (
    <div data-testid="capture-unsure-question" aria-label="คำถามรายการที่ยังไม่แน่ใจ" className="space-y-2">
      <p className="line-clamp-2 text-base font-semibold break-words">{buildUnsureQuestion(draft)}</p>
      <div className="grid gap-2">
        {UNSURE_CHOICES.map(choice => (
          <button type="button" key={choice.value} onClick={() => onAnswer(choice.value)}
            className="min-h-[52px]! w-full rounded-xl border border-[#cdbf9f] bg-background px-3 text-left text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring">
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface CaptureReviewCardProps {
  draft: CaptureDraft;
  accounts: Account[];
  categories: Category[];
  largeText: boolean;
  compact: boolean;
  unsure: boolean;
  text: string;
  today?: string;
  transfer?: { label: string; onEdit: () => void };
  onAnswer: (answer: UnsureAnswer) => void;
  onChange: (patch: Partial<CaptureDraft>) => void;
  onSave: () => void;
  onEditText?: () => void;
  onExpand?: () => void;
  disabled: boolean;
  saving: boolean;
  children?: ReactNode;
  suggestion?: ReactNode;
}

export function CaptureReviewCard({ draft, accounts, categories, largeText, compact, unsure, text, today, transfer,
  onAnswer, onChange, onSave, onEditText, onExpand, disabled, saving, children, suggestion }: CaptureReviewCardProps) {
  const { t, locale } = useTranslation();
  const [editingAmount, setEditingAmount] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (editingAmount) amountRef.current?.focus({ preventScroll: true });
  }, [editingAmount]);
  const [amountText, setAmountText] = useState(draft.amountCents === null ? "" : String(draft.amountCents / 100));
  const [lastAmount, setLastAmount] = useState(draft.amountCents);
  if (draft.amountCents !== lastAmount) {
    setLastAmount(draft.amountCents);
    setAmountText(draft.amountCents === null ? "" : String(draft.amountCents / 100));
  }
  function commitAmount(value: string) {
    setAmountText(value);
    const cleaned = value.replace(/,/g, "").trim();
    let cents: number | null = null;
    if (/^\d+(\.\d{0,2})?$/.test(cleaned)) {
      try { cents = parseMoneyToCents(cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned); } catch { /* Keep invalid input editable. */ }
    }
    setLastAmount(cents);
    onChange({ amountCents: cents });
  }
  const category = categories.find(c => c.id === draft.categoryId);
  const categoryName = category ? locale === "th" ? category.name_th : category.name_en : "ยังไม่แน่ใจ";
  const account = accounts.find(a => a.id === draft.accountId);
  const amount = draft.amountCents === null ? "—" : formatMoney(draft.amountCents);
  const direction = transfer ? "โอนระหว่างบัญชี" : draft.type === "income" ? "ได้รับ" : "จ่ายไป";
  const confidenceLabel = t(draft.confidence === "high" ? "capture.confidenceHigh" : draft.confidence === "medium" ? "capture.confidenceMedium" : "capture.confidenceLow");
  const dateValue = new Date(`${draft.date}T00:00:00Z`);
  const calendarDay = Number.isFinite(dateValue.getTime()) ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(dateValue) : draft.date;
  const day = draft.date === today ? `${t("capture.today")} ${calendarDay}` : calendarDay;
  const chip = "min-h-11 min-w-0 max-w-full rounded-full border border-[#e3d5b8] bg-background px-3 text-base";
  const dateControl = (simple: boolean) => (
    <label className={cn("relative flex items-center focus-within:ring-2 focus-within:ring-ring", simple ? "min-h-11 text-xl" : chip)}>
      <span>{day}</span>{!simple && <Pencil className="pointer-events-none ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <input type="date" tabIndex={compact ? -1 : undefined} aria-label={simple ? "วันที่รายการ" : "แก้ไขวันที่"} value={draft.date}
        onChange={e => { if (e.target.value) onChange({ date: e.target.value }); }}
        className="absolute inset-0 min-h-11 w-full min-w-0 cursor-pointer opacity-0" />
    </label>
  );
  const amountControl = (simple: boolean) => (
    <div className={cn("flex min-h-11 min-w-0 items-baseline font-bold tabular-nums", simple ? "text-[44px]" : "text-3xl")}>
      {editingAmount || simple ? <>
        <span aria-hidden="true">฿</span>
        <input ref={amountRef} aria-label="จำนวนเงิน" tabIndex={compact && !editingAmount ? -1 : undefined} inputMode="decimal" autoComplete="off" value={amountText}
          onFocus={() => setEditingAmount(true)} onChange={e => commitAmount(e.target.value)} onBlur={() => setEditingAmount(false)}
          className={cn("min-h-11 w-full min-w-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring", simple ? "text-[44px]" : "text-3xl")} />
      </> : <button type="button" aria-label="แก้ไขจำนวนเงิน" tabIndex={compact ? -1 : undefined} className="min-h-11 max-w-full text-left break-all" onClick={() => setEditingAmount(true)}>
        {transfer ? "" : draft.type === "expense" ? "−" : "+"}{amount}
      </button>}
    </div>
  );
  return (
    <section data-paper-ignore="" data-testid="capture-review-card" aria-label="ตรวจสอบรายการก่อนบันทึก"
      className={cn("relative flex min-h-0 min-w-0 flex-col rounded-2xl border border-[#e3d5b8] bg-[#fffaf0] p-4 shadow-[0_6px_14px_rgba(60,40,10,0.12)] dark:border-white/15 dark:bg-card", compact ? "py-1" : "max-h-[calc(100dvh-21rem)] space-y-3")}>
      {compact && (
        <button type="button" data-testid="capture-review-strip" aria-label="สรุปรายการ" onClick={onExpand} className="min-h-11 w-full truncate text-left text-sm">
          {transfer ? "" : draft.type === "expense" ? "−" : "+"}{amount} · {!largeText && <>{transfer ? `โอน · ${transfer.label}` : `${categoryName} ${confidenceLabel} · ${account?.name ?? "เลือกบัญชี"}`} · </>}{day}
        </button>
      )}
      {suggestion}
      <div className={compact || suggestion ? "sr-only" : "min-h-0 overflow-y-auto space-y-3"}>
      {largeText ? (
        <div className="space-y-3 text-xl">
          <div><span className="block text-base text-muted-foreground">อะไร</span>
            <button type="button" tabIndex={compact ? -1 : undefined} className="line-clamp-2 min-h-11 w-full text-left text-xl break-words" onClick={onEditText}>
              <span className="mr-2 font-semibold">{direction}</span>{draft.merchant ?? draft.description ?? text}
            </button>
          </div>
          <div><span className="block text-base text-muted-foreground">เท่าไร</span>{amountControl(true)}</div>
          <div><span className="block text-base text-muted-foreground">วันไหน</span>{dateControl(true)}</div>
        </div>
      ) : <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {amountControl(false)}<span className="text-sm">{unsure ? "ยังไม่แน่ใจ" : direction}</span>
        </div>
        <div data-testid="capture-review-chips" className="flex flex-wrap gap-2">
          {transfer ? <button type="button" tabIndex={compact ? -1 : undefined} className={cn(chip, "truncate")} onClick={transfer.onEdit}>{transfer.label}</button> : <>
          {!unsure && <label className={cn(chip, "flex items-center gap-1")}>
            <select aria-label="แก้ไขหมวดหมู่" tabIndex={compact ? -1 : undefined} value={draft.categoryId ?? ""}
              onChange={e => onChange({ categoryId: e.target.value || null, categorySource: "learned", categoryConfirmedByUser: !!e.target.value })}
              className="min-h-11 min-w-0 max-w-[120px] appearance-none bg-transparent text-base">
              <option value="">เลือกหมวด</option>
              {categories.filter(c => (c.type === draft.type || c.type === "both")).map(c => <option key={c.id} value={c.id}>{locale === "th" ? c.name_th : c.name_en}</option>)}
            </select>
            {!unsure && <ConfidenceBadge confidence={draft.confidence} />}
            <Pencil className="pointer-events-none size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </label>}
          <label className={cn(chip, "flex max-w-[160px] items-center gap-1")}><select aria-label="แก้ไขบัญชี" tabIndex={compact ? -1 : undefined} className="min-h-11 min-w-0 max-w-[124px] appearance-none truncate bg-transparent text-base" value={draft.accountId ?? ""} onChange={e => onChange({ accountId: e.target.value || null, subscriptionAccountMissing: !e.target.value && draft.subscriptionAccountMissing })}>
            <option value="">เลือกบัญชี</option>
            {accounts.filter(a => !a.is_archived).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select><Pencil className="pointer-events-none size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /></label>
          </>}
          {dateControl(false)}
        </div>
      </>}
      {unsure && <CaptureUnsureQuestion draft={draft} onAnswer={onAnswer} />}
      </div>
      {!compact && <CaptureSaveButton onSave={onSave} disabled={disabled} saving={saving} largeText={largeText} pending={unsure}>{children}</CaptureSaveButton>}
      {!compact && !largeText && <p className="shrink-0 text-center text-xs text-muted-foreground">อ่านในเครื่อง</p>}
    </section>
  );
}
