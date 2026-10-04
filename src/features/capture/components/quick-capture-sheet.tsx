"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { cheerCompanion } from "@/features/companions/presence";
import { ArrowLeftRight, Camera, ImageUp, Loader2, PencilLine, TrendingUp, X } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SuccessBadge } from "@/components/illustrations";
import { formatMoney } from "@/lib/financial/money";
import { toLocalDateString, addMonthsClamped } from "@/lib/date";
import { useSpeechInput } from "@/lib/speech/use-speech-input";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useSwipeToDismiss } from "@/hooks/use-swipe-to-dismiss";
import {
  defaultAccountId,
  matchAccount,
  normalizeText,
  parseCaptureText,
  suggestCategory,
  type CaptureMerchantPreference,
  type ParseContext,
} from "@/lib/capture/transaction-parser";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";
import { mergeAIParse, needsAIAssist, recapItemsNeedingAI, type AIParseFields } from "@/lib/capture/ai-fallback";
import { isMultiItemRecap, parseRecap } from "@/lib/capture/recap";
import { applyCaptureDate } from "@/lib/capture/capture-date";
import type { ReceiptExtraction } from "@/lib/capture/receipt-normalize";
import type { TransactionPrefill } from "@/features/transactions/components/transaction-form";
import { deleteTransaction } from "@/features/transactions/actions";
import { createRecurringTransaction } from "@/features/recurring/actions";
import {
  assistCaptureParse,
  assistRecapCategories,
  checkCaptureDuplicate,
  dismissRecurringSuggestion,
  getCapturePreferences,
  saveCapturedTransaction,
  scanReceipt,
  type PossibleDuplicate,
  type RecurringSuggestion,
} from "@/features/capture/actions";
import { prepareReceiptImage } from "@/features/capture/lib/image";
import { TransactionPreview } from "./transaction-preview";
import { HoldToTalkButton } from "./hold-to-talk-button";
import { RecapReview, type RecapRow } from "./recap-review";
import { MicPermissionTip } from "./mic-permission-tip";
import { CaptureDatePicker } from "./capture-date-picker";

interface QuickCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  /** Hands off to the existing full form ("กรอกแบบละเอียด"), prefilled with whatever was captured. */
  onManual: (prefill: TransactionPrefill) => void;
  onIncome: () => void;
  onTransfer: () => void;
}

type ReceiptState =
  | { status: "idle" }
  | { status: "scanning"; previewUrl: string }
  | { status: "done"; previewUrl: string; extraction: ReceiptExtraction | null; message: string | null; mock?: boolean };

/** Pause after typing and allow at most one AI pass for one capture session. */
const AI_ASSIST_DEBOUNCE_MS = 1200;
const AI_ASSIST_MAX_PER_OPEN = 1;
/** Recap category passes per open (each covers a whole recap, not one item). */
const RECAP_AI_MAX_PER_OPEN = 2;
/** Tallest the auto-growing text box gets before it scrolls. */
const TEXT_MAX_HEIGHT = 168;

function centsToPrefillAmount(cents: number | null) {
  return cents === null ? undefined : (cents / 100).toString();
}

/**
 * Quick Capture — the default "+" path. Type (or say) one short sentence,
 * see the parsed result live, tap ✓. Receipts/slips go through the same
 * preview but are never saved without an explicit tap. The detailed form
 * stays one tap away for anything the quick path can't express.
 */
export function QuickCaptureSheet({
  open,
  onOpenChange,
  accounts,
  categories,
  onManual,
  onIncome,
  onTransfer,
}: QuickCaptureSheetProps) {
  const { t, locale } = useTranslation();
  const keyboardInset = useKeyboardInset(open);
  // Pull down to close; content scrolls freely in its own area below the header.
  const { sheetRef, scrollRef } = useSwipeToDismiss({
    enabled: open,
    onDismiss: () => {
      speech.stop();
      setPickedDate(null);
      onOpenChange(false);
    },
  });
  // Requested 2026-10-04: the sheet unfolds OUT of the center "+" button and
  // folds back INTO it, like the companion window (SheetContent
  // motion="grow"). The scale origin must sit on the + button's center, in
  // the sheet's own coordinates — set when the sheet mounts (before its
  // first animated frame) and again whenever it moves (keyboard lift).
  const sheetElRef = useRef<HTMLElement | null>(null);
  const aimAtFab = useCallback((el: HTMLElement | null) => {
    // The visible floating circle (BottomNav), not the invisible nav-cell
    // trigger under it — that sits lower, so the sheet would aim below the +.
    const fab = document.querySelector("[data-fab-circle]") ?? document.querySelector("[data-fab-trigger]");
    if (!el || !fab) return;
    const r = fab.getBoundingClientRect();
    el.style.transformOrigin = `${r.left + r.width / 2 - el.offsetLeft}px ${r.top + r.height / 2 - el.offsetTop}px`;
  }, []);
  const attachSheet = useCallback(
    (el: HTMLElement | null) => {
      sheetElRef.current = el;
      sheetRef(el);
      aimAtFab(el);
    },
    [sheetRef, aimAtFab]
  );
  useLayoutEffect(() => {
    aimAtFab(sheetElRef.current);
  }, [open, keyboardInset, aimAtFab]);
  const [text, setText] = useState("");
  const [textSource, setTextSource] = useState<"quick_text" | "voice">("quick_text");
  const [overrides, setOverrides] = useState<Partial<CaptureDraft>>({});
  const [preferences, setPreferences] = useState<CaptureMerchantPreference[]>([]);
  const [receipt, setReceipt] = useState<ReceiptState>({ status: "idle" });
  const [receiptDraft, setReceiptDraft] = useState<CaptureDraft | null>(null);
  const [duplicate, setDuplicate] = useState<PossibleDuplicate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Hybrid parsing: validated AI readings keyed by normalized sentence. A key
  // is claimed before its request starts, so re-renders, retyping the same
  // text or a failed call never trigger a second request for it.
  const [aiReadings, setAiReadings] = useState<Record<string, AIParseFields | null>>({});
  const [aiPendingKey, setAiPendingKey] = useState<string | null>(null);
  const aiRequestedRef = useRef<Set<string>>(new Set());
  const aiCallsRef = useRef(0);
  // Daily recap: per-item edits/removals keyed by "index:source words", the
  // AI's category picks, and one stable idempotency key per item so a
  // retried confirm never saves an item twice.
  const [recapOverrides, setRecapOverrides] = useState<Record<string, Partial<CaptureDraft>>>({});
  const [recapRemoved, setRecapRemoved] = useState<Set<string>>(() => new Set());
  const [recapAI, setRecapAI] = useState<Record<string, string>>({});
  const [recapAIPendingKey, setRecapAIPendingKey] = useState<string | null>(null);
  const [recapProgress, setRecapProgress] = useState<{ done: number; total: number } | null>(null);
  const recapRequestIdsRef = useRef<Record<string, string>>({});
  const recapAICallsRef = useRef(0);
  // The day being recorded: null = today (so it follows the clock), or a
  // day the user picked to catch up on. Reset whenever the sheet closes.
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const speech = useSpeechInput(locale, (transcript) => {
    setTextSource("voice");
    setOverrides({});
    setText(transcript);
  });

  // Learned merchant → category mappings: fetched once per open, cheap.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCapturePreferences()
      .then((prefs) => {
        if (!cancelled) setPreferences(prefs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ctx: ParseContext = useMemo(
    () => ({ accounts, categories, merchantPreferences: preferences, today: toLocalDateString(new Date()) }),
    [accounts, categories, preferences]
  );

  // Fresh per-open AI budget.
  useEffect(() => {
    if (open) aiCallsRef.current = 0;
  }, [open]);

  const captureDate = pickedDate ?? ctx.today;
  const textKey = normalizeText(text);
  const localParsed = useMemo(() => (textKey ? parseCaptureText(textKey, ctx) : null), [textKey, ctx]);
  // Two or more priced items in one sentence ("ข้าว 40 น้ำ 10 เงินเดือนออก
  // 20,000") become a list confirmed together instead of a single preview.
  const recapItems = useMemo(() => (text.trim() && receipt.status === "idle" ? parseRecap(text, ctx) : []), [text, ctx, receipt.status]);
  const recapMode = isMultiItemRecap(recapItems);
  const recapRows: RecapRow[] = useMemo(() => {
    if (!recapMode) return [];
    return recapItems.flatMap((item, i) => {
      const id = `${i}:${item.sourceText}`;
      if (recapRemoved.has(id)) return [];
      const aiCategory = recapAI[id];
      const base: CaptureDraft = {
        type: item.type,
        amountCents: item.amountCents,
        categoryId: aiCategory ?? item.categoryId,
        categorySource: aiCategory ? "ai" : item.categorySource,
        accountId: item.accountId,
        merchant: item.merchant,
        description: item.description,
        date: applyCaptureDate(item.date, ctx.today, captureDate),
        confidence: aiCategory ? "medium" : item.confidence,
        source: textSource,
        categoryConfirmedByUser: false,
      };
      return [{ id, sourceText: item.sourceText, draft: { ...base, ...recapOverrides[id] } }];
    });
  }, [recapMode, recapItems, recapRemoved, recapAI, recapOverrides, textSource, ctx.today, captureDate]);
  const aiReading = aiReadings[textKey] ?? null;

  // One AI pass only for a sentence the rules could not fully read (never for
  // "ข้าว 80 cash"-style input), after the user pauses, max 1 per open.
  useEffect(() => {
    if (!open || !localParsed || receipt.status !== "idle" || speech.listening || recapMode) return;
    if (aiRequestedRef.current.has(textKey) || aiCallsRef.current >= AI_ASSIST_MAX_PER_OPEN) return;
    if (!needsAIAssist(textKey, localParsed)) return;
    const key = textKey;
    const timer = setTimeout(() => {
      aiRequestedRef.current.add(key);
      aiCallsRef.current += 1;
      setAiPendingKey(key);
      assistCaptureParse(key)
        .then((res) => {
          if (res.status === "ok") setAiReadings((prev) => ({ ...prev, [key]: res.fields }));
        })
        .catch(() => {})
        .finally(() => setAiPendingKey((k) => (k === key ? null : k)));
    }, AI_ASSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, textKey, localParsed, receipt.status, speech.listening, recapMode]);

  // Recap: ONE AI pass picks categories for the items the rules could only
  // file under "Other" — after the user stops talking/typing. Amounts and
  // types are never touched by it.
  useEffect(() => {
    if (!open || !recapMode || speech.listening) return;
    const key = `recap:${textKey}`;
    if (aiRequestedRef.current.has(key) || recapAICallsRef.current >= RECAP_AI_MAX_PER_OPEN) return;
    const indices = recapItemsNeedingAI(recapItems);
    if (indices.length === 0) return;
    const timer = setTimeout(() => {
      aiRequestedRef.current.add(key);
      recapAICallsRef.current += 1;
      setRecapAIPendingKey(key);
      const asked = indices.map((i) => ({
        id: `${i}:${recapItems[i].sourceText}`,
        description: recapItems[i].description ?? recapItems[i].sourceText,
        type: recapItems[i].type,
      }));
      assistRecapCategories(asked.map(({ description, type }) => ({ description, type })))
        .then((res) => {
          if (res.status !== "ok") return;
          setRecapAI((prev) => {
            const next = { ...prev };
            for (const [index, categoryId] of Object.entries(res.categories)) {
              const item = asked[Number(index)];
              if (item) next[item.id] = categoryId;
            }
            return next;
          });
        })
        .catch(() => {})
        .finally(() => setRecapAIPendingKey((k) => (k === key ? null : k)));
    }, AI_ASSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, recapMode, speech.listening, textKey, recapItems]);

  // The text box grows with a long recap, up to a cap, then scrolls.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXT_MAX_HEIGHT)}px`;
  }, [text, open]);

  const textDraft: CaptureDraft | null = useMemo(() => {
    if (!localParsed) return null;
    const parsed = aiReading ? mergeAIParse(textKey, localParsed, aiReading, ctx) : localParsed;
    return {
      type: parsed.type,
      amountCents: parsed.amountCents,
      categoryId: parsed.categoryId,
      categorySource: parsed.categorySource,
      accountId: parsed.accountId,
      merchant: parsed.merchant,
      description: parsed.description,
      date: applyCaptureDate(parsed.date, ctx.today, captureDate),
      confidence: parsed.confidence,
      source: textSource,
      categoryConfirmedByUser: false,
      ...overrides,
    };
  }, [localParsed, aiReading, textKey, ctx, textSource, overrides, captureDate]);

  const activeDraft = receipt.status !== "idle" ? receiptDraft : textDraft;

  function resetAll() {
    setText("");
    setTextSource("quick_text");
    setOverrides({});
    setReceipt({ status: "idle" });
    setReceiptDraft(null);
    setDuplicate(null);
    setError(null);
    setRecapOverrides({});
    setRecapRemoved(new Set());
    setRecapAI({});
    setRecapProgress(null);
    setPickedDate(null);
  }

  function clearReceipt() {
    if (receipt.status !== "idle") URL.revokeObjectURL(receipt.previewUrl);
    setReceipt({ status: "idle" });
    setReceiptDraft(null);
    setDuplicate(null);
  }

  // ---------------------------------------------------------------- receipt

  /**
   * Draft from a scan result. Anything the scan couldn't read is filled
   * from what the user had already typed (`fallback`), so a partial or
   * failed scan never throws away information that was already captured.
   */
  function draftFromExtraction(extraction: ReceiptExtraction | null, fallback: CaptureDraft | null): CaptureDraft {
    const merchant = extraction?.merchant ?? fallback?.merchant ?? fallback?.description ?? null;
    const scannedCategory = extraction?.merchant ? suggestCategory(extraction.merchant, extraction.merchant, "expense", ctx) : null;
    const category =
      scannedCategory && scannedCategory.source !== "fallback"
        ? scannedCategory
        : fallback && fallback.categorySource !== "fallback"
          ? { categoryId: fallback.categoryId, source: fallback.categorySource }
          : (scannedCategory ?? suggestCategory("", null, "expense", ctx));
    const account = extraction?.paymentMethod ? matchAccount(extraction.paymentMethod, accounts) : null;
    const amountCents = extraction?.amountCents ?? fallback?.amountCents ?? null;
    let confidence = extraction?.confidence ?? "low";
    // Never "high" if the category was a blind guess.
    if (confidence === "high" && category.source === "fallback") confidence = "medium";
    return {
      type: "expense",
      amountCents,
      categoryId: category.categoryId,
      categorySource: category.source,
      accountId: account?.accountId ?? fallback?.accountId ?? defaultAccountId(accounts),
      merchant,
      description: null,
      date: extraction?.date ?? fallback?.date ?? ctx.today,
      confidence,
      source: "receipt",
      reference: extraction?.reference ?? null,
      categoryConfirmedByUser: false,
    };
  }

  async function handleImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    setDuplicate(null);
    if (receipt.status !== "idle") URL.revokeObjectURL(receipt.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    setReceipt({ status: "scanning", previewUrl });
    // Keep whatever was already typed — a scan never discards captured info.
    const typed = textDraft;
    try {
      const prepared = await prepareReceiptImage(file);
      if (!prepared.ok) {
        // Too big / unsupported: say so instead of a request the server rejects.
        const message = prepared.reason === "too_large" ? t("capture.scanTooLarge") : t("capture.scanInvalid");
        setReceipt({ status: "done", previewUrl, extraction: null, message });
        setReceiptDraft(draftFromExtraction(null, typed));
        return;
      }
      const formData = new FormData();
      formData.append("image", prepared.file);
      const result = await scanReceipt(formData);
      if (result.status === "ok") {
        const partial =
          !result.extraction.isPaymentDocument
            ? t("capture.notAReceipt")
            : result.extraction.amountCents === null || !result.extraction.merchant
              ? t("capture.partialRead")
              : null;
        setReceipt({ status: "done", previewUrl, extraction: result.extraction, message: partial, mock: result.mock });
        setReceiptDraft(draftFromExtraction(result.extraction, typed));
      } else {
        setReceipt({ status: "done", previewUrl, extraction: null, message: result.message });
        setReceiptDraft(draftFromExtraction(null, typed));
      }
    } catch {
      setReceipt({ status: "done", previewUrl, extraction: null, message: t("capture.scanFailed") });
      setReceiptDraft(draftFromExtraction(null, typed));
    }
  }

  // ---------------------------------------------------------------- save

  function patchDraft(patch: Partial<CaptureDraft>) {
    if (receipt.status !== "idle") setReceiptDraft((d) => (d ? { ...d, ...patch } : d));
    else setOverrides((o) => ({ ...o, ...patch }));
    if (patch.amountCents !== undefined) setDuplicate(null);
  }

  function showRecurringPrompt(suggestion: RecurringSuggestion, draft: CaptureDraft) {
    toast(t("capture.recurringTitle"), {
      description: `${suggestion.merchant} · ${formatMoney(suggestion.amountCents)}`,
      duration: 12000,
      action: {
        label: t("capture.recurringSetup"),
        onClick: async () => {
          const fd = new FormData();
          fd.set("type", "expense");
          fd.set("amount", (suggestion.amountCents / 100).toFixed(2));
          fd.set("account_id", draft.accountId ?? "");
          if (draft.categoryId) fd.set("category_id", draft.categoryId);
          fd.set("merchant", suggestion.merchant);
          fd.set("frequency", suggestion.frequency);
          fd.set("start_date", toLocalDateString(addMonthsClamped(new Date(`${draft.date}T00:00:00`), 1)));
          fd.set("is_active", "true");
          const res = await createRecurringTransaction(undefined, fd);
          if (res.success) toast.success(t("capture.recurringSaved"), { icon: <SuccessBadge /> });
          else if (res.error) toast.error(res.error);
        },
      },
      cancel: {
        label: t("capture.recurringNo"),
        onClick: () => void dismissRecurringSuggestion(suggestion),
      },
    });
  }

  async function save(options: { skipDuplicateCheck?: boolean } = {}) {
    const draft = activeDraft;
    if (!draft || saving) return;
    const payload = buildCaptureSaveInput(draft, clientRequestId);
    if (!payload) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("capture.offline"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (draft.source === "receipt" && !options.skipDuplicateCheck) {
        const dup = await checkCaptureDuplicate({
          amountCents: payload.amountCents,
          date: payload.date,
          merchant: payload.merchant,
          reference: payload.reference ?? null,
        });
        if (dup) {
          setDuplicate(dup);
          return;
        }
      }

      const result = await saveCapturedTransaction(payload);
      if (!result.success) {
        // Keep everything on screen — nothing captured is lost.
        setError(result.error ?? t("capture.saveFailed"));
        return;
      }

      const needsReview = !(draft.confidence === "high" || draft.categoryConfirmedByUser);
      const savedId = result.transactionId;
      cheerCompanion();
      toast.success(`${needsReview ? t("capture.savedNeedsReview") : t("capture.saved")} ${formatMoney(payload.amountCents)}`, {
        icon: <SuccessBadge />,
        action: savedId
          ? {
              label: t("capture.undo"),
              onClick: async () => {
                const res = await deleteTransaction(savedId);
                if (res.success) toast(t("capture.undone"));
                else if (res.error) toast.error(res.error);
              },
            }
          : undefined,
      });
      if (result.recurringSuggestion) showRecurringPrompt(result.recurringSuggestion, draft);

      setClientRequestId(crypto.randomUUID());
      clearReceipt();
      resetAll();
      onOpenChange(false);
    } catch {
      setError(t("capture.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Saves every recap item through the same idempotent single-item path.
   * Confirming the list IS the user's review: each category they saw that
   * wasn't a blind "Other" guess counts as confirmed (and is learned for
   * next time); blind guesses land in the Daily Inbox to pick a category.
   * A partial failure keeps only the unsaved items on screen.
   */
  async function confirmRecap() {
    if (saving) return;
    const rows = recapRows.filter((r) => canSaveDraft(r.draft));
    if (rows.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("capture.offline"));
      return;
    }
    setSaving(true);
    setError(null);
    setRecapProgress({ done: 0, total: rows.length });
    const savedRowIds: string[] = [];
    const savedTransactionIds: string[] = [];
    let needsReview = 0;
    let failed = 0;
    for (const row of rows) {
      const requestId = (recapRequestIdsRef.current[row.id] ??= crypto.randomUUID());
      const reviewed = row.draft.categoryConfirmedByUser || (row.draft.categorySource !== "fallback" && row.draft.categoryId !== null);
      const payload = buildCaptureSaveInput({ ...row.draft, categoryConfirmedByUser: reviewed }, requestId);
      try {
        const result = payload ? await saveCapturedTransaction(payload) : null;
        if (result?.success) {
          savedRowIds.push(row.id);
          if (result.transactionId) savedTransactionIds.push(result.transactionId);
          delete recapRequestIdsRef.current[row.id];
          if (!reviewed) needsReview += 1;
        } else failed += 1;
      } catch {
        failed += 1;
      }
      setRecapProgress({ done: savedRowIds.length + failed, total: rows.length });
    }
    setSaving(false);
    setRecapProgress(null);

    if (savedRowIds.length > 0) {
      cheerCompanion();
      toast.success(t("capture.recap.saved").replace("{n}", String(savedRowIds.length)), {
        icon: <SuccessBadge />,
        description: needsReview > 0 ? t("capture.recap.savedReview").replace("{n}", String(needsReview)) : undefined,
        action: savedTransactionIds.length
          ? {
              label: t("capture.undo"),
              onClick: async () => {
                const results = await Promise.all(savedTransactionIds.map((id) => deleteTransaction(id)));
                if (results.every((r) => r.success)) toast(t("capture.undone"));
                else toast.error(t("capture.saveFailed"));
              },
            }
          : undefined,
      });
    }
    if (failed > 0) {
      setRecapRemoved((prev) => new Set([...prev, ...savedRowIds]));
      setError(t("capture.recap.partialFailed").replace("{n}", String(failed)));
      return;
    }
    resetAll();
    onOpenChange(false);
  }

  function openManual() {
    const draft = activeDraft;
    const prefill: TransactionPrefill = draft
      ? {
          amount: centsToPrefillAmount(draft.amountCents),
          categoryId: draft.categoryId,
          accountId: draft.accountId ?? undefined,
          merchant: draft.merchant ?? draft.description,
          date: draft.date,
        }
      : {};
    clearReceipt();
    resetAll();
    onOpenChange(false);
    onManual(prefill);
  }

  const receiptHeading = receipt.status === "done" && receipt.extraction?.isPaymentDocument ? t("capture.detected") : t("capture.preview");

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          speech.stop();
          setPickedDate(null);
        }
        onOpenChange(next);
      }}
    >
      <SheetContent
        ref={attachSheet}
        motion="grow"
        side="bottom"
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl p-0 pb-[calc(env(safe-area-inset-bottom)+12px)] motion-reduce:transition-none sm:mx-auto sm:max-w-lg"
        // iOS overlays the keyboard instead of resizing the page — lift the
        // sheet above it. While the keyboard is up the sheet takes ALL the
        // space above it (a fixed height, not its content's), so typing the
        // first letter — which adds the preview card — never makes the sheet
        // grow and its top jump. It glides with the keyboard (transition).
        style={
          keyboardInset > 0
            ? {
                bottom: keyboardInset,
                height: `calc(100dvh - ${keyboardInset}px - 1rem)`,
                maxHeight: `calc(100dvh - ${keyboardInset}px - 1rem)`,
                paddingBottom: 12,
              }
            : undefined
        }
      >
        {/* Grab handle: the visual cue that the sheet can be pulled down to close. */}
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="shrink-0 pt-2 pb-2">
          <SheetTitle className="text-lg">{t("capture.title")}</SheetTitle>
          <SheetDescription>{t("capture.subtitle")}</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 px-4">
            {/* Type — the primary path. Enter saves when the preview is ready. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="relative"
            >
              <label htmlFor="quick-capture-input" className="sr-only">
                {t("capture.inputLabel")}
              </label>
              <textarea
                id="quick-capture-input"
                ref={textRef}
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setTextSource("quick_text");
                  setOverrides({});
                  setError(null);
                  if (receipt.status !== "idle") clearReceipt();
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  // One item: Enter saves. A recap: Enter just closes the keyboard to review the list.
                  if (recapMode) e.currentTarget.blur();
                  else void save();
                }}
                placeholder={speech.listening ? t("capture.listening") : t("capture.recap.placeholder")}
                autoComplete="off"
                enterKeyHint="done"
                className="block min-h-13 w-full resize-none rounded-2xl border bg-background px-4 py-3 pr-11 text-base leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              {text ? (
                <button
                  type="button"
                  aria-label={t("common.clear")}
                  onClick={() => {
                    setText("");
                    setOverrides({});
                    textRef.current?.focus();
                  }}
                  className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </form>

            <CaptureDatePicker value={captureDate} today={ctx.today} onChange={(d) => setPickedDate(d === ctx.today ? null : d)} />

            {/* Examples fold away smoothly once typing starts (no one-frame jump). */}
            <div
              aria-hidden={Boolean(text) || receipt.status !== "idle"}
              inert={Boolean(text) || receipt.status !== "idle"}
              className={cn(
                "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out motion-reduce:transition-none",
                !text && receipt.status === "idle" ? "grid-rows-[1fr] opacity-100" : "-mt-3 grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="flex min-h-0 flex-wrap gap-1.5 overflow-hidden">
                {(["example1", "example2", "recap.example"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setText(t(`capture.${key}`));
                      setTextSource("quick_text");
                    }}
                    className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t(`capture.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Capture methods — the mic is the hero: hold, talk through the day, release. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 justify-self-center pt-4 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="flex size-12 items-center justify-center rounded-full border bg-card shadow-xs">
                  <Camera className="size-5" aria-hidden="true" />
                </span>
                {t("capture.scan")}
              </button>
              <HoldToTalkButton
                listening={speech.listening}
                disabled={!speech.supported}
                onStart={() => {
                  setError(null);
                  if (receipt.status !== "idle") clearReceipt();
                  textRef.current?.blur();
                  speech.startHold(text);
                }}
                onStop={() => speech.stopHold()}
              />
              <button
                type="button"
                onClick={openManual}
                className="flex flex-col items-center gap-1.5 justify-self-center pt-4 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="flex size-12 items-center justify-center rounded-full border bg-card shadow-xs">
                  <PencilLine className="size-5" aria-hidden="true" />
                </span>
                {t("capture.manual")}
              </button>
            </div>
            {speech.supported && !speech.listening ? <MicPermissionTip /> : null}
            {!speech.supported ? <p className="text-xs text-muted-foreground">{t("capture.voiceUnsupported")}</p> : null}
            {speech.error ? <p className="text-xs text-amber-700 dark:text-amber-400">{t("capture.voiceError")}</p> : null}

            {/* Two inputs: the camera (capture) and the photo library. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleImage(file);
              }}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleImage(file);
              }}
            />
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ImageUp className="size-3.5" aria-hidden="true" />
              {t("capture.uploadImage")}
            </button>

            {receipt.status !== "idle" ? (
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- transient local object URL, never uploaded as-is or stored */}
                <img src={receipt.previewUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1 text-sm">
                  {receipt.status === "scanning" ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {t("capture.scanning")}
                    </p>
                  ) : (
                    <>
                      {receipt.message ? <p className="font-medium text-amber-800 dark:text-amber-300">{receipt.message}</p> : null}
                      {receipt.message ? <p className="text-xs text-muted-foreground">{t("capture.partialReadHint")}</p> : null}
                      {receipt.mock ? <p className="text-xs text-muted-foreground">{t("capture.mockLabel")}</p> : null}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={t("common.close")}
                  onClick={clearReceipt}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {recapMode ? (
              <RecapReview
                rows={recapRows}
                accounts={accounts}
                categories={categories}
                onChange={(id, patch) => setRecapOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))}
                onRemove={(id) => setRecapRemoved((prev) => new Set([...prev, id]))}
                onConfirm={() => void confirmRecap()}
                saving={saving}
                progress={recapProgress}
                aiPending={recapAIPendingKey !== null}
              />
            ) : null}

            {activeDraft && receipt.status !== "scanning" && !recapMode ? (
              <TransactionPreview
                draft={activeDraft}
                accounts={accounts}
                categories={categories}
                heading={receipt.status !== "idle" ? receiptHeading : t("capture.preview")}
                onChange={patchDraft}
                onSave={() => void save()}
                onSaveAnyway={() => {
                  setDuplicate(null);
                  void save({ skipDuplicateCheck: true });
                }}
                onEdit={openManual}
                saving={saving}
                saveLabel={receipt.status !== "idle" ? t("capture.correct") : t("capture.save")}
                duplicate={duplicate}
                notice={
                  receipt.status !== "idle" ? undefined : aiPendingKey === textKey ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      {t("capture.aiAssisting")}
                    </p>
                  ) : aiReading ? (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {t("capture.aiAssisted")}
                    </p>
                  ) : undefined
                }
              />
            ) : null}

            {error ? (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {accounts.length === 0 ? (
              <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/money/accounts" />}>
                {t("capture.addAccount")}
              </Button>
            ) : null}

            {/* Everything the old "+" menu offered stays reachable. */}
            <div className="flex gap-2 border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 text-emerald-700 dark:text-emerald-400"
                onClick={() => {
                  resetAll();
                  onOpenChange(false);
                  onIncome();
                }}
              >
                <TrendingUp className="mr-1.5 size-4" aria-hidden="true" />
                {t("capture.income")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  resetAll();
                  onOpenChange(false);
                  onTransfer();
                }}
              >
                <ArrowLeftRight className="mr-1.5 size-4" aria-hidden="true" />
                {t("capture.transfer")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <BlackHoleFab open={open} />
    </>
  );
}

// Must match --motion-companion-close in globals.css.
const BLACK_HOLE_CLOSE_MS = 680;

/**
 * The "black hole" for Quick Capture's close (requested 2026-10-04): while
 * the sheet is being pulled into the "+" button, a copy of that button is
 * raised ABOVE the sheet (portaled to <body>, z-60 — the real one lives in
 * BottomNav's own stacking context under the sheet), so the shrinking sheet
 * disappears inside it instead of leaving a little thumbnail on top. It
 * swells as it "swallows", then is removed once the close has finished.
 * Shown only while closing; decorative (aria-hidden).
 */
function BlackHoleFab({ open }: { open: boolean }) {
  const [hole, setHole] = useState<{ rect: DOMRect; background: string } | null>(null);
  const wasOpenRef = useRef(open);

  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open || !wasOpen) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const circle = document.querySelector<HTMLElement>("[data-fab-circle]");
    if (!circle) return;
    // Closing just started: surface the + at the circle's exact spot/look.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHole({ rect: circle.getBoundingClientRect(), background: getComputedStyle(circle).background });
    const timer = window.setTimeout(() => setHole(null), BLACK_HOLE_CLOSE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!hole) return null;
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] flex items-center justify-center rounded-full border border-white/25 shadow-[0_0_24px_4px_color-mix(in_oklab,var(--primary)_55%,transparent),inset_0_1px_0_rgba(255,255,255,0.35)] animate-[black-hole-gulp_var(--motion-companion-close)_ease-in-out_forwards]"
      style={{
        left: hole.rect.left,
        top: hole.rect.top,
        width: hole.rect.width,
        height: hole.rect.height,
        background: hole.background,
      }}
    >
      <span className="text-3xl leading-none font-light text-white">+</span>
    </div>,
    document.body
  );
}
