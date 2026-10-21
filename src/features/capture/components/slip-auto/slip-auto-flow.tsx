"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Account, Category } from "@/types/database";
import type { SlipBatchResult } from "@/lib/slip/batch";
import { todayInTimeZone } from "@/lib/date";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/financial/money";
import { defaultAccountId, type CaptureMerchantPreference } from "@/lib/capture/transaction-parser";
import { useMerchantMemory } from "../../use-merchant-memory";
import { getCapturePreferences, saveCapturedTransaction } from "../../actions";
import { getSlipCandidates } from "../../slip-auto-actions";
import { processSlipBatch } from "../../lib/slip-batch-import";
import { recognizeSlipText } from "../../lib/local-slip-ocr";
import { localSlipQRDecoder } from "../../lib/local-slip-qr";
import { readingModel, reviewModel, resolveSlip, slipSavePayloads, undoSlipBatch, type SavedSlip, type SlipSelections } from "../../lib/slip-auto-model";
import { getMonthlySpendSummary } from "@/features/dashboard/monthly-spend-actions";
import { deleteTransactionsBatch } from "@/features/transactions/actions";
import { MonthlySpendDetail } from "@/features/dashboard/components/monthly-spend-detail";
import { monthlyCategoryHref, shiftSpendMonth } from "@/features/dashboard/lib/monthly-spend";
import { SlipPickSheet } from "./slip-pick-sheet";
import { SlipReadingProgress } from "./slip-reading-progress";
import { SlipReviewSheet } from "./slip-review-sheet";
import { SlipSavedState } from "./slip-saved-state";
import type { MonthlySpendSummary, SlipSavedViewModel } from "./types";

export interface SlipAutoHandle { start(files?: File[]): void }
export const SlipAutoFlow = forwardRef<SlipAutoHandle, { accounts: Account[]; categories: Category[]; onTransfer?: () => void }>(function SlipAutoFlow({ accounts, categories, onTransfer }, ref) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<"pick" | "reading" | "review" | "saved" | "month">("pick");
  const stageRef = useRef(stage); stageRef.current = stage;
  const [progress, setProgress] = useState(readingModel(0, 0));
  const [batch, setBatch] = useState<SlipBatchResult | null>(null);
  const [selections, setSelections] = useState<SlipSelections>({});
  const [accountId, setAccountId] = useState("");
  const [preferences, setPreferences] = useState<CaptureMerchantPreference[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const completed = useRef(new Set<string>());
  const saved = useRef<SavedSlip[]>([]);
  const unlearn = useRef(new Map<string, () => void>());
  const controller = useRef<AbortController | null>(null);
  const [summary, setSummary] = useState<MonthlySpendSummary | null>(null);
  const [savedVM, setSavedVM] = useState<SlipSavedViewModel | null>(null);
  const [month, setMonth] = useState(todayInTimeZone().slice(0, 7));
  const monthRequest = useRef(0);
  const batchSpent = useRef(0);
  const [editing, setEditing] = useState<string | null>(null);
  const memory = useMerchantMemory(visible);
  const ctx = useMemo(() => ({ accounts, categories, merchantPreferences: preferences, deviceMemory: memory.entries, today: todayInTimeZone() }), [accounts, categories, preferences, memory.entries]);
  const vm = batch ? reviewModel(batch, selections, ctx) : null;
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => { if (visible) void getCapturePreferences().then(setPreferences).catch(() => {}); }, [visible]);

  async function read(files: File[]) {
    if (!files.length || busyRef.current) return;
    if (files.length > 500) { toast.error("กรุณาเลือกไม่เกิน 500 สลิปต่อครั้ง"); return; }
    busyRef.current = true;
    setStage("reading"); setVisible(true); setProgress(readingModel(0, files.length));
    completed.current.clear(); saved.current = []; unlearn.current.clear(); setSelections({}); setBatch(null); setSavedVM(null);
    const abort = new AbortController(); controller.current = abort;
    const recent: typeof progress.recent = [];
    try {
      const result = await processSlipBatch(files, {
        ocr: recognizeSlipText, qrDecode: image => localSlipQRDecoder.decode(image), signal: abort.signal,
        fetchCandidates: slips => getSlipCandidates({ dates: slips.flatMap(s => s.date ? [s.date] : []), references: slips.flatMap(s => s.reference ? [s.reference] : []) }),
        onItemRead: item => {
          const row = resolveSlip(item, {}, ctx);
          recent.unshift({ id: String(item.index), title: row.title, categoryLabel: row.categoryLabel, direction: row.direction, amountCents: row.amountCents });
          recent.splice(3);
        },
        onProgress: p => { if (!abort.signal.aborted) setProgress({ ...readingModel(p.completed, p.total), recent: [...recent] }); },
      });
      // Retain the engine's stable request ID. Only explicitly separate,
      // identical no-reference items within this review need distinct keys.
      const seen = new Set<string>();
      for (const item of result.items) {
        if (!item.slip.reference && item.status !== "duplicate" && seen.has(item.clientRequestId)) item.clientRequestId = crypto.randomUUID();
        seen.add(item.clientRequestId);
      }
      if (abort.signal.aborted) return;
      setBatch(result); setStage("review");
    } catch (error) {
      if (!abort.signal.aborted) { toast.error(error instanceof Error ? error.message : "อ่านสลิปไม่สำเร็จ กรุณาลองอีกครั้ง"); setStage("pick"); }
    } finally { files.length = 0; busyRef.current = false; }
  }
  useImperativeHandle(ref, () => ({ start(files) {
    setVisible(true);
    if (busyRef.current || saved.current.length || stageRef.current === "review") { if (files) files.length = 0; return; }
    setStage("pick");
    if (files?.length) void read(files);
  } }));
  function answer(id: string, choice: string) {
    if (busyRef.current || completed.current.has(id)) return;
    if (choice === "edit") { setEditing(id); return; }
    if (choice === "transfer") {
      if (!onTransfer) return;
      setBatch(current => current ? {
        items: current.items.filter(i => i.clientRequestId !== id),
        ready: current.ready.filter(i => i.clientRequestId !== id),
        unsure: current.unsure.filter(i => i.clientRequestId !== id),
        duplicate: current.duplicate,
      } : null);
      setVisible(false); onTransfer(); return;
    }
    patch(id, { direction: choice === "income" ? "income" : "expense", categoryId: undefined, confirmed: false });
  }
  function patch(id: string, change: SlipSelections[string]) { if (busyRef.current || completed.current.has(id)) return; setSelections(current => ({ ...current, [id]: { ...current[id], ...change } })); }
  async function loadMonth(next: string) {
    const request = ++monthRequest.current;
    try {
      const data = await getMonthlySpendSummary(next);
      if (request !== monthRequest.current) return;
      setSummary(data); setMonth(next);
      if (data && stageRef.current === "saved") setSavedVM(savedModel(data));
    } catch { if (request === monthRequest.current) toast.error("ไม่สามารถโหลดสรุปรายเดือนได้ กรุณาลองอีกครั้ง"); }
  }
  function savedModel(data: MonthlySpendSummary): SlipSavedViewModel {
    return { savedCount: saved.current.length, duplicateCount: (batch?.duplicate.length ?? 0) + completed.current.size - saved.current.length, monthLabel: data.monthLabel, monthSpentCents: data.spentCents, batchSpentCents: batchSpent.current, monthIncomeCents: data.incomeCents, monthLeftCents: data.leftCents, segments: data.categories.map(c => ({ id: c.id, percent: c.percent })) };
  }
  async function save() {
    if (!batch || busyRef.current) return;
    const selectedAccount = accountId || defaultAccountId(accounts) || "";
    if (!selectedAccount) { toast.error("กรุณาเพิ่มบัญชีก่อนบันทึก"); return; }
    let payloads;
    try { payloads = slipSavePayloads(batch, selections, ctx, selectedAccount); }
    catch (error) { toast.error((error as Error).message); return; }
    busyRef.current = true; setBusy(true);
    let failed = false;
    try {
      for (const input of payloads) {
        if (completed.current.has(input.clientRequestId)) continue;
        try {
          const result = await saveCapturedTransaction(input);
          if (!result.success || !result.transactionId) { toast.error(result.error ?? "บันทึกไม่สำเร็จ"); failed = true; continue; }
          completed.current.add(input.clientRequestId);
          if (result.inserted === false) continue;
          saved.current.push({ id: result.transactionId, clientRequestId: input.clientRequestId });
          const item = batch.items.find(i => i.clientRequestId === input.clientRequestId)!;
          const selection = selections[item.clientRequestId] ?? {};
          const row = resolveSlip(item, selection, ctx);
          if (row.categoryId && (selection.confirmed || (selection.direction && row.categorySource !== "fallback"))) {
            const undo = await memory.rememberSlip({ text: row.title, categoryId: row.categoryId, direction: row.direction, source: "correction" });
            unlearn.current.set(input.clientRequestId, undo);
          }
        } catch { failed = true; toast.error("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      }
      router.refresh();
      if (failed) return;
      const currentMonth = ctx.today.slice(0, 7);
      let data: MonthlySpendSummary | null = null;
      try { data = await getMonthlySpendSummary(currentMonth); } catch { toast.error("บันทึกแล้ว แต่โหลดสรุปรายเดือนไม่สำเร็จ"); }
      setSummary(data); setMonth(currentMonth);
      const ids = new Set(saved.current.map(s => s.clientRequestId));
      batchSpent.current = payloads.filter(p => ids.has(p.clientRequestId) && p.type === "expense" && p.date.startsWith(currentMonth)).reduce((sum, p) => sum + p.amountCents, 0);
      setSavedVM(data ? savedModel(data) : null);
      setStage("saved");
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function undo() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      // Reverse order also unwinds multiple learning observations for one merchant.
      const result = await undoSlipBatch([...saved.current].reverse(), deleteTransactionsBatch);
      for (const row of result.removed) { unlearn.current.get(row.clientRequestId)?.(); unlearn.current.delete(row.clientRequestId); completed.current.delete(row.clientRequestId); }
      saved.current = result.remaining.reverse(); router.refresh();
      await loadMonth(month);
      if (result.remaining.length) { setSavedVM(null); toast.error("เลิกทำบางรายการไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
      setVisible(false); setStage("pick"); setBatch(null); setSavedVM(null); completed.current.clear();
    } finally { busyRef.current = false; setBusy(false); }
  }
  const editItem = batch?.items.find(i => i.clientRequestId === editing);
  return <>
    {!visible && (stage === "reading" || stage === "review" || saved.current.length > 0) ? <Button className="fixed right-4 bottom-24 z-40" aria-label="กลับไปดูสลิป" onClick={() => setVisible(true)}><Bell />{stage === "reading" ? `${progress.done}/${progress.total}` : stage === "review" ? batch?.items.length : saved.current.length}</Button> : null}
    {stage === "pick" && visible ? <SlipPickSheet onPick={files => void read(files)} onTakePhoto={file => void read([file])} onClose={() => setVisible(false)} /> : null}
    <Sheet open={visible && stage !== "pick"} onOpenChange={next => { if (!busy) setVisible(next); }}>
      <SheetContent side="bottom" className={stage === "review" ? "inset-0! h-dvh! max-h-none! p-0" : "max-h-[96dvh] overflow-y-auto"}>
        <SheetHeader className={stage === "review" ? "sr-only" : undefined}><SheetTitle>สลิปโอนเงิน</SheetTitle></SheetHeader>
        {stage === "reading" ? <SlipReadingProgress vm={progress} onLater={() => setVisible(false)} /> : null}
        {stage === "review" && vm ? <>
          <SlipReviewSheet vm={vm} saving={busy} onSaveAll={() => void save()} onAnswer={answer} onChangeCategory={(id, categoryId) => patch(id, { categoryId, confirmed: true })}
            controls={<><label>บัญชี<select aria-label="บัญชีสำหรับชุดสลิป" value={accountId || defaultAccountId(accounts) || ""} disabled={busy} onChange={e => setAccountId(e.target.value)}>{accounts.filter(a => !a.is_archived).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><Button variant="ghost" onClick={() => setVisible(false)}>ไว้ดูทีหลัง</Button>{saved.current.length ? <Button variant="ghost" disabled={busy} onClick={() => void undo()}>เลิกทำชุดนี้</Button> : null}</>} />
        </> : null}
        {stage === "saved" ? savedVM ? <SlipSavedState vm={savedVM} onUndo={() => void undo()} onViewMonth={() => { if (!busyRef.current) setStage("month"); }} onBackHome={() => { setVisible(false); router.push("/dashboard"); }} onScanMore={() => { if (busyRef.current) return; saved.current = []; completed.current.clear(); setStage("pick"); }} /> : <><p role="status">บันทึกแล้ว {saved.current.length} รายการ</p><Button disabled={busy} onClick={() => void undo()}>เลิกทำชุดนี้</Button><Button onClick={() => void loadMonth(month)}>โหลดสรุปอีกครั้ง</Button></> : null}
        {stage === "month" ? <MonthlySpendDetail summary={summary} onMonthChange={delta => void loadMonth(shiftSpendMonth(month, delta))} onViewCategory={id => { setVisible(false); router.push(monthlyCategoryHref(month, id)); }} /> : null}
      </SheetContent>
    </Sheet>
    <Dialog open={!!editItem} onOpenChange={next => { if (!next) setEditing(null); }}>
      <DialogContent className="z-60" overlayClassName="z-60"><DialogHeader><DialogTitle>แก้ไขรายละเอียดสลิป</DialogTitle></DialogHeader>
        {editItem ? <form key={editItem.clientRequestId} onSubmit={e => {
          e.preventDefault(); const form = new FormData(e.currentTarget);
          try { const amountCents = parseMoneyToCents(String(form.get("amount"))); if (amountCents <= 0 || amountCents >= 10 ** 15) throw new Error(); patch(editItem.clientRequestId, { amountCents, date: String(form.get("date")), direction: form.get("direction") === "income" ? "income" : "expense", accountId: String(form.get("account")), reference: String(form.get("reference")) || null }); setEditing(null); }
          catch { toast.error("กรุณาตรวจสอบจำนวนเงิน"); }
        }}>
          <label>จำนวนเงิน<Input name="amount" inputMode="decimal" required defaultValue={centsToDecimalString(selections[editItem.clientRequestId]?.amountCents ?? editItem.slip.amount ?? 0)} /></label>
          <label>วันที่<Input name="date" type="date" required defaultValue={selections[editItem.clientRequestId]?.date ?? editItem.slip.date ?? ""} /></label>
          <label>ประเภท<select name="direction" defaultValue={selections[editItem.clientRequestId]?.direction ?? editItem.direction ?? "expense"}><option value="expense">รายจ่าย</option><option value="income">รายรับ</option></select></label>
          <label>บัญชี<select name="account" required defaultValue={selections[editItem.clientRequestId]?.accountId ?? (accountId || defaultAccountId(accounts) || "")}>{accounts.filter(a => !a.is_archived).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <label>เลขอ้างอิง<Input name="reference" maxLength={80} defaultValue={selections[editItem.clientRequestId]?.reference ?? editItem.slip.reference ?? ""} /></label>
          <Button type="submit">ยืนยัน</Button>
        </form> : null}
      </DialogContent>
    </Dialog>
  </>;
});
