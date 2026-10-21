"use client";

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { cheerCompanion } from "@/features/companions/presence";
import { LiveStatus } from "@/components/shared/live-status";
import { ArrowLeftRight, Camera, ImageUp, Loader2, PencilLine, TrendingUp, X } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SuccessBadge } from "@/components/illustrations";
import { formatMoney } from "@/lib/financial/money";
import { handFont } from "@/components/notebook/hand-font";
import { toLocalDateString, addMonthsClamped } from "@/lib/date";
import { useSpeechInput } from "@/lib/speech/use-speech-input";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useSwipeToDismiss } from "@/hooks/use-swipe-to-dismiss";
import {
  normalizeText,
  parseCaptureText,
  type CaptureMerchantPreference,
  type CaptureUnit,
  type ParseContext,
} from "@/lib/capture/transaction-parser";
import { buildCaptureSaveInput, canSaveDraft, smartCaptureNeedsAnswer, memoryNeedsConfirmation, type CaptureDraft } from "@/lib/capture/draft";
import { mergeAIParse, needsAIAssist, recapItemsNeedingAI, type AIParseFields } from "@/lib/capture/ai-fallback";
import { isMultiItemRecap, parseRecap, recapTotals } from "@/lib/capture/recap";
import { applyCaptureDate } from "@/lib/capture/capture-date";
import type { ReceiptExtraction } from "@/lib/capture/receipt-normalize";
import type { TransactionPrefill } from "@/features/transactions/components/transaction-form";
import { createTransfer, deleteTransaction } from "@/features/transactions/actions";
import { getAccountAliases, saveAccountAlias, type AccountAlias } from "@/features/accounts/actions";
import { getCaptureUnits, getIncomeSourceUnits } from "@/features/capture/units";
import { mergeCaptureUnits, toCaptureUnits } from "@/lib/capture/units";
import { createRecurringTransaction } from "@/features/recurring/actions";
import {
  assistCaptureParse,
  assistRecapCategories,
  checkCaptureDuplicate,
  dismissRecurringSuggestion,
  getCaptureEmergencyFundAccountId,
  getCapturePreferences,
  type PossibleDuplicate,
  type RecurringSuggestion,
} from "@/features/capture/actions";
import { reviewScrollDelta } from "@/features/capture/lib/review-visibility";
import { SlipAutoFlow, type SlipAutoHandle } from "./slip-auto/slip-auto-flow";
import { parseCancelIntent } from "@/lib/capture/subscription-intent";
import { evaluateCaptureConfidence } from "@/lib/capture/confidence";
import { useMerchantMemory } from "../use-merchant-memory";
import { saveCaptureDraft } from "../save-capture-draft";
import { SubscriptionCancelCard } from "./subscription-cancel-card";
import { useCaptureDisplay, useCaptureViewport } from "../use-capture-display";
import { CaptureReviewCard, CaptureSaveButton } from "./capture-review-card";
import { CaptureLargeTextToggle, CaptureTextSuggestion } from "./capture-display-controls";
import { applyUnsureAnswer, needsUnsureQuestion, pendingUnsureDraft } from "@/lib/capture/unsure-answer";
import { TransactionPreview } from "./transaction-preview";
import { HoldToTalkButton } from "./hold-to-talk-button";
import { RecapReview, type RecapRow } from "./recap-review";
import { MicPermissionTip } from "./mic-permission-tip";
import { CaptureDatePicker } from "./capture-date-picker";
import { TransferPreview } from "./transfer-preview";
import { detectTransferIntent, type AliasedAccount } from "@/lib/capture/transfer";

interface QuickCaptureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  categories: Category[];
  /** Hands off to the existing full form ("กรอกแบบละเอียด"), prefilled with whatever was captured. */
  onManual: (prefill: TransactionPrefill) => void;
  onIncome: () => void;
  onTransfer: () => void;
  /** Words handed over from the voice notebook ("แก้ไข / พิมพ์เอง"), filled in on open. */
  initialText?: string | null;
  /** Image selected by the shell’s already-mounted slip picker. */
  initialImageFile?: File | null;
  initialImageFiles?: File[] | null;
  onInitialImageConsumed?: () => void;
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
  initialText = null,
  initialImageFile = null,
  initialImageFiles = null,
  onInitialImageConsumed,
}: QuickCaptureSheetProps) {
  const { t, locale } = useTranslation();
  const memory = useMerchantMemory(open);
  const display = useCaptureDisplay();
  const { layout: captureDisplayLayout, viewport: captureViewport } = useCaptureViewport(open);
  const zoomed = useRef(false);
  const hasRecorded = useRef(false);
  useEffect(() => {
    const zoom = (captureViewport?.scale ?? 1) > 1;
    if (open && zoom && !zoomed.current) display.effort();
    zoomed.current = zoom;
  }, [captureViewport?.scale, open, display]);
  // A string-array dictionary entry (live-status steps), with a single-line fallback.
  const tList = (key: string, fallbackKey: string): string[] => {
    const value = t(key) as unknown;
    return Array.isArray(value) ? (value as string[]) : [t(fallbackKey)];
  };
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
  const [emergencyFundAccountId, setEmergencyFundAccountId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CaptureMerchantPreference[]>([]);
  // Per-unit prices ("ดื่ม" = ฿200): "ได้ 10 ดื่ม" is 10 × the price.
  const [unitSources, setUnitSources] = useState<{ saved: CaptureUnit[]; income: { unit_label: string; unit_rate: string }[] }>({ saved: [], income: [] });
  const [receipt, setReceipt] = useState<ReceiptState>({ status: "idle" });
  const [receiptDraft, setReceiptDraft] = useState<CaptureDraft | null>(null);
  const [duplicate, setDuplicate] = useState<PossibleDuplicate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientRequestId, setClientRequestId] = useState(() => crypto.randomUUID());
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const micPressedAtRef = useRef(0);
  const prefixRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const pinnedReviewRef = useRef<HTMLDivElement>(null);
  const [holdLayout, setHoldLayout] = useState<{ prefixHeight: number; sheetHeight: number; reviewHeight: number } | null>(null);
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
  const [aliases, setAliases] = useState<AccountAlias[]>([]);
  const [transferPicks, setTransferPicks] = useState<{ key: string; from?: string; to?: string }>({ key: "" });

  const speech = useSpeechInput(locale, (transcript) => {
    setTextSource("voice");
    setOverrides({});
    setTransferPicks({ key: "" });
    setText(transcript);
  });

  // Voice notebook hand-off: start from what was said, once per open.
  const appliedInitialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      appliedInitialRef.current = null;
      return;
    }
    if (!initialText || appliedInitialRef.current === initialText) return;
    appliedInitialRef.current = initialText;
    setTextSource("voice");
    setOverrides({});
    setText(initialText);
  }, [open, initialText]);

  // Learned merchant → category mappings: fetched once per open, cheap.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([getCapturePreferences(), getAccountAliases(), getCaptureUnits(), getIncomeSourceUnits(), getCaptureEmergencyFundAccountId()])
      .then(([prefs, accountAliases, unitRows, incomeUnits, emergencyId]) => {
        if (cancelled) return;
        setPreferences(prefs);
        setEmergencyFundAccountId(emergencyId);
        setAliases(accountAliases);
        setUnitSources({ saved: toCaptureUnits(unitRows), income: incomeUnits });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ctx: ParseContext = useMemo(
    () => ({
      accounts,
      emergencyFundAccountId,
      categories,
      merchantPreferences: preferences,
      deviceMemory: memory.entries,
      units: mergeCaptureUnits(
        unitSources.saved,
        unitSources.income,
        categories.find((c) => c.is_system && c.name_en === "Salary" && c.type === "income")?.id ?? null
      ),
      today: toLocalDateString(new Date()),
    }),
    [accounts, emergencyFundAccountId, categories, preferences, unitSources, memory.entries]
  );

  // Fresh per-open AI budget.
  useEffect(() => {
    if (open) aiCallsRef.current = 0;
  }, [open]);

  const captureDate = pickedDate ?? ctx.today;
  // Parsing (and re-rendering the list) trails the text box at low priority,
  // so live dictation and typing stay smooth (the mic "stuttered" while every
  // interim word re-parsed the whole recap synchronously).
  const parseText = useDeferredValue(text);
  const textKey = normalizeText(parseText);
  const localParsed = useMemo(() => (textKey ? parseCaptureText(textKey, ctx) : null), [textKey, ctx]);
  const aliasedAccounts: AliasedAccount[] = useMemo(
    () => accounts.map((account) => ({ ...account, aliases: aliases.filter((alias) => alias.account_id === account.id).map((alias) => alias.alias_normalized) })),
    [accounts, aliases]
  );
  // Two or more priced items in one sentence ("ข้าว 40 น้ำ 10 เงินเดือนออก
  // 20,000") become a list confirmed together instead of a single preview.
  const recapItems = useMemo(
    () => (parseText.trim() && receipt.status === "idle" ? parseRecap(parseText, ctx) : []),
    [parseText, ctx, receipt.status]
  );
  const recapMode = isMultiItemRecap(recapItems);
  const transferIntent = useMemo(
    () => (!recapMode && receipt.status === "idle" && textKey ? detectTransferIntent(textKey, aliasedAccounts) : null),
    [recapMode, receipt.status, textKey, aliasedAccounts]
  );
  const recapRows: RecapRow[] = useMemo(() => {
    if (!recapMode) return [];
    return recapItems.flatMap((item, i) => {
      const id = `${i}:${item.sourceText}`;
      if (recapRemoved.has(id)) return [];
      const aiCategory = recapAI[id];
      const base: CaptureDraft = {
        learningBaseline: { categoryId: aiCategory ?? item.categoryId, type: item.type },
        confidenceGate: evaluateCaptureConfidence(item, { ...ctx, text: item.sourceText }),
        smart: item.smart,
        subscription: item.subscription,
        subscriptionAccountMissing: item.subscriptionAccountMissing,
        cancelIntent: item.cancelIntent,
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
  }, [recapMode, recapItems, recapRemoved, recapAI, recapOverrides, textSource, ctx, captureDate]);
  const aiReading = aiReadings[textKey] ?? null;

  // One AI pass only for a sentence the rules could not fully read (never for
  // "ข้าว 80 cash"-style input), after the user pauses, max 1 per open.
  useEffect(() => {
    if (!open || !localParsed || receipt.status !== "idle" || speech.listening || recapMode || transferIntent) return;
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
  }, [open, textKey, localParsed, receipt.status, speech.listening, recapMode, transferIntent]);

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

  // The text box grows with a long recap, up to a cap, then scrolls inside.
  // Measured before paint and whenever the box (re)mounts or changes width —
  // a measurement taken while the sheet was still opening left it stuck at
  // two clipped lines. While dictating, it follows the newest words.
  const fitText = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXT_MAX_HEIGHT)}px`;
  }, []);
  useLayoutEffect(() => {
    if (!speech.listening) fitText();
    const el = textRef.current;
    if (el && speech.listening) el.scrollTop = el.scrollHeight;
  }, [text, open, fitText, speech.listening]);
  const textObserverRef = useRef<ResizeObserver | null>(null);
  const attachText = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textObserverRef.current?.disconnect();
      textObserverRef.current = null;
      textRef.current = el;
      if (!el) return;
      fitText();
      if (typeof ResizeObserver === "undefined") return;
      let width = el.clientWidth;
      textObserverRef.current = new ResizeObserver(() => {
        if (el.clientWidth === width) return;
        width = el.clientWidth;
        fitText();
      });
      textObserverRef.current.observe(el);
    },
    [fitText]
  );

  // Tapping the box: iOS scrolls the page to "reveal" the field while our
  // sheet is also lifting above the keyboard, so the box ended up in the
  // middle with its top cut off. Once the keyboard is up, undo the page
  // scroll and bring the box back to the top of the sheet.
  useEffect(() => {
    if (keyboardInset === 0 || document.activeElement !== textRef.current) return;
    const id = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      scrollRef.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [keyboardInset, scrollRef]);

  const textDraft: CaptureDraft | null = useMemo(() => {
    if (!localParsed) return null;
    const parsed = aiReading ? mergeAIParse(textKey, localParsed, aiReading, ctx) : localParsed;
    return {
      learningBaseline: { categoryId: parsed.categoryId, type: parsed.type },
      confidenceGate: evaluateCaptureConfidence(parsed, { ...ctx, text: textKey }),
      isEmergencyFundDraw: parsed.isEmergencyFundDraw,
      emergencyFundAccountMissing: parsed.emergencyFundAccountMissing,
      installment: parsed.installment,
      smart: parsed.smart,
      subscription: parsed.subscription,
      subscriptionAccountMissing: parsed.subscriptionAccountMissing,
      cancelIntent: parsed.cancelIntent,
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

  const ordinaryTextDraft = textDraft && !transferIntent && !recapMode ? applyUnsureAnswer(textDraft, display.answer(textKey), categories) : textDraft;
  const activeDraft = receipt.status !== "idle" ? receiptDraft : ordinaryTextDraft;
  const pinnedDraft = receipt.status !== "scanning" && !recapMode && activeDraft && !activeDraft.cancelIntent ? activeDraft : null;
  const unsure = receipt.status === "idle" && !transferIntent && !!pinnedDraft && !display.answer(textKey) && needsUnsureQuestion(pinnedDraft, textKey);
  // Boolean presence keeps the order stable as the draft changes while typing.
  const hasReview = recapMode || Boolean(activeDraft) || receipt.status !== "idle";
  const reviewFirst = !speech.listening && hasReview;
  const reviewReady = receipt.status !== "scanning" && (recapMode || Boolean(activeDraft));
  useEffect(() => {
    if (!open || !reviewFirst || !reviewReady) return;
    let timer: number;
    const reveal = () => {
      // Let keyboardInset's scroll-to-top effect own text entry on iOS.
      // Also avoid interrupting edits inside a review card.
      if (keyboardInset > 0 || sheetElRef.current?.contains(document.activeElement) &&
          document.activeElement?.matches("input, textarea, select")) return;
      const scroll = scrollRef.current;
      const actions = reviewRef.current?.querySelectorAll("button");
      const action = actions?.[actions.length - 1];
      if (!scroll || !action) return;
      const viewport = scroll.getBoundingClientRect();
      const rect = action.getBoundingClientRect();
      const delta = reviewScrollDelta(viewport.bottom, rect.bottom);
      if (delta > 0) scroll.scrollTo({
        top: scroll.scrollTop + delta,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    };
    // Wait for the sheet/keyboard's height transition, once per appearance.
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(reveal, 240); };
    schedule();
    const sheet = sheetElRef.current;
    sheet?.addEventListener("focusout", schedule);
    return () => { window.clearTimeout(timer); sheet?.removeEventListener("focusout", schedule); };
  }, [open, reviewFirst, reviewReady, keyboardInset, scrollRef]);

  const currentTransferPicks = transferPicks.key === textKey ? transferPicks : { key: textKey };
  const transferSide = (side: "from" | "to"): string | null => {
    const picked = currentTransferPicks[side];
    if (picked) return picked;
    const slot = transferIntent?.[side];
    return slot?.status === "matched" ? slot.accountId : null;
  };

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
    setTransferPicks({ key: "" });
  }

  function clearReceipt() {
    if (receipt.status !== "idle") URL.revokeObjectURL(receipt.previewUrl);
    setReceipt({ status: "idle" });
    setReceiptDraft(null);
    setDuplicate(null);
  }

  // ---------------------------------------------------------------- receipt

  const slipFlowRef = useRef<SlipAutoHandle>(null);
  function handleImages(files: File[]) {
    if (!files.length) return;
    speech.stop();
    onOpenChange(false);
    slipFlowRef.current?.start(files);
  }
  function handleImage(file: File | undefined) {
    if (file) handleImages([file]);
  }

  const appliedInitialImageRef = useRef<File | File[] | null>(null);
  // Check each render so handleImage uses current capture state. The ref also
  // prevents Strict Mode effect replay from starting a second scan.
  useEffect(() => {
    const images = initialImageFiles ?? initialImageFile;
    if (!images) {
      appliedInitialImageRef.current = null;
      return;
    }
    if (!open || appliedInitialImageRef.current === images) return;
    appliedInitialImageRef.current = images;
    handleImages(Array.isArray(images) ? [...images] : [images]);
    onInitialImageConsumed?.();
  });

  // ---------------------------------------------------------------- save

  function patchDraft(patch: Partial<CaptureDraft>) {
    display.effort();
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

  async function save(options: { skipDuplicateCheck?: boolean; deferUnsure?: boolean } = {}) {
    const deferUnsure = options.deferUnsure ?? unsure;
    const draft = activeDraft && deferUnsure ? pendingUnsureDraft(activeDraft) : activeDraft;
    if (!draft || saving || draft.cancelIntent || (receipt.status === "idle" && parseCancelIntent(text))) return;
    if (transferIntent && draft.amountCents !== null) {
      const fromId = transferSide("from");
      const toId = transferSide("to");
      if (!fromId || !toId || fromId === toId) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError(t("capture.offline"));
        return;
      }
      setSaving(true);
      setError(null);
      const form = new FormData();
      form.set("from_account_id", fromId);
      form.set("to_account_id", toId);
      form.set("amount", (draft.amountCents / 100).toFixed(2));
      form.set("transaction_date", draft.date);
      form.set("client_request_id", clientRequestId);
      try {
        const result = await createTransfer(undefined, form);
        if (!result.success) {
          setError(result.error ?? t("capture.saveFailed"));
          return;
        }
        cheerCompanion();
        toast.success(`${t("capture.saved")} ${formatMoney(draft.amountCents)}`, {
          icon: <SuccessBadge />,
          action: result.transactionId
            ? {
                label: t("capture.undo"),
                onClick: async () => {
                  const undone = await deleteTransaction(result.transactionId!);
                  if (undone.success) toast(t("capture.undone"));
                  else toast.error(undone.error ?? t("capture.saveFailed"));
                },
              }
            : undefined,
        });
        setClientRequestId(crypto.randomUUID());
        resetAll();
        onOpenChange(false);
      } catch {
        setError(t("capture.saveFailed"));
      } finally {
        setSaving(false);
      }
      return;
    }
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

      const result = await saveCaptureDraft(draft, payload);
      if (!result.success) {
        // Keep everything on screen — nothing captured is lost.
        setError(result.error ?? t("capture.saveFailed"));
        return;
      }
      if (result.incomplete) {
        // Payment saved, a smart part is missing: same draft + same request id retries only the gap.
        setError(t("capture.smart.partialFailed"));
        return;
      }

      const undoLearning = deferUnsure ? () => {} : await memory.remember(textKey, draft, ctx);
      const needsReview = !(draft.confidence === "high" || draft.categoryConfirmedByUser);
      const savedId = draft.smart && draft.smartAssetAccepted !== false ? undefined : result.transactionId;
      cheerCompanion();
      toast.success(`${needsReview ? t("capture.savedNeedsReview") : t("capture.saved")} ${formatMoney(payload.amountCents)}`, {
        icon: <SuccessBadge />,
        action: savedId
          ? {
              label: t("capture.undo"),
              onClick: async () => {
                const res = await deleteTransaction(savedId);
                if (res.success) {
                  undoLearning();
                  toast(t("capture.undone"));
                }
                else if (res.error) toast.error(res.error);
              },
            }
          : undefined,
      });
      if (result.recurringError) toast.error(t("capture.subscription.recurringFailed"));
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
    if (recapRows.some((r) => smartCaptureNeedsAnswer(r.draft) || memoryNeedsConfirmation(r.draft))) return;
    const rows = recapRows.filter((r) => canSaveDraft(r.draft));
    if (rows.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("capture.offline"));
      return;
    }
    setSaving(true);
    setError(null);
    setRecapProgress({ done: 0, total: rows.length });
    const undoLearning = new Map<string, () => void>();
    const savedRowIds: string[] = [];
    const savedTransactionIds: string[] = [];
    let needsReview = 0;
    let failed = 0;
    for (const row of rows) {
      const requestId = (recapRequestIdsRef.current[row.id] ??= crypto.randomUUID());
      const reviewed = row.draft.categoryConfirmedByUser || (row.draft.categorySource !== "fallback" && row.draft.categoryId !== null);
      const payload = buildCaptureSaveInput({ ...row.draft, categoryConfirmedByUser: reviewed }, requestId);
      try {
        const result = payload ? await saveCaptureDraft(row.draft, payload) : null;
        if (result?.success && result.incomplete) {
          toast.error(t("capture.smart.partialFailed"));
          failed += 1; // keep the row + its request id; a retry fills only the missing parts
        } else if (result?.success) {
          if (result.recurringError) toast.error(t("capture.subscription.recurringFailed"));
          if (result.transactionId) undoLearning.set(result.transactionId, await memory.remember(row.sourceText, row.draft, ctx));
          savedRowIds.push(row.id);
          if (result.transactionId && (!row.draft.smart || row.draft.smartAssetAccepted === false)) savedTransactionIds.push(result.transactionId);
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
        action: savedTransactionIds.length && !rows.some((r) => r.draft.smart && r.draft.smartAssetAccepted !== false)
          ? {
              label: t("capture.undo"),
              onClick: async () => {
                const results = await Promise.all(savedTransactionIds.map((id) => deleteTransaction(id)));
                // Undo snapshots in reverse save order when rows share a key.
                for (let i = results.length - 1; i >= 0; i--) {
                  if (results[i].success) undoLearning.get(savedTransactionIds[i])?.();
                }
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

  const pinnedSaveDisabled = saving || !pinnedDraft || Boolean(duplicate) || (transferIntent
    ? !pinnedDraft.amountCents || !transferSide("from") || !transferSide("to") || transferSide("from") === transferSide("to")
    : !canSaveDraft(pinnedDraft));
  const batchSaveDisabled = saving || !recapRows.some(r => canSaveDraft(r.draft)) || recapRows.some(r => smartCaptureNeedsAnswer(r.draft) || memoryNeedsConfirmation(r.draft));
  const batchTotals = recapTotals(recapRows.map(r => r.draft));
  const batchSummary = `${recapRows.length} รายการ · จ่ายไป ${formatMoney(batchTotals.expenseCents)} · ได้รับ ${formatMoney(batchTotals.incomeCents)}`;
  const captureSuggestion = display.suggestion && captureDisplayLayout === "a" && !speech.listening ? <CaptureTextSuggestion amount={activeDraft?.amountCents != null ? formatMoney(activeDraft.amountCents) : undefined} direction={activeDraft?.type === "income" ? "ได้รับ" : "จ่ายไป"} onTry={() => display.setLargeText(true)} onDismiss={display.dismissSuggestion} /> : null;
  const batchReview = recapMode ? <section data-testid="capture-review-card" aria-label="ตรวจสอบรายการก่อนบันทึก" className="space-y-3 rounded-2xl border bg-card p-4 shadow-card">
    {captureSuggestion ?? <p className={cn(captureDisplayLayout === "b" ? "truncate text-sm" : display.largeText ? "text-xl" : "text-base font-semibold")}>{batchSummary}</p>}
    {captureDisplayLayout !== "b" && <CaptureSaveButton onSave={() => void confirmRecap()} disabled={batchSaveDisabled} saving={saving} largeText={display.largeText}>บันทึก {recapRows.length} รายการ</CaptureSaveButton>}
  </section> : null;

  const review = (recapMode || activeDraft || receipt.status !== "idle" || error) ? (
    <div ref={reviewRef} className="space-y-3">
      <details open={!display.largeText || receipt.status === "scanning" || Boolean(error) || Boolean(duplicate)} className="space-y-3">
      <summary className={display.largeText ? "min-h-11 cursor-pointer py-2 text-lg font-semibold" : "hidden"}>ตรวจสอบรายละเอียด</summary>
      {receipt.status !== "idle" ? (
        <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- transient local object URL, never uploaded as-is or stored */}
          <img src={receipt.previewUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1 text-sm">
            {receipt.status === "scanning" ? (
              <p className="flex min-w-0 items-center gap-2">
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                {/* Live status: each step the slip reader actually does. */}
                <LiveStatus lines={tList("capture.scanningSteps", "capture.scanning")} />
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
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {recapMode ? (
        <RecapReview
          rows={recapRows}
          hideSave
          accounts={accounts}
          categories={categories}
          onChange={(id, patch) => { display.effort(); setRecapOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })); }}
          onRemove={(id) => setRecapRemoved((prev) => new Set([...prev, id]))}
          onConfirm={() => void confirmRecap()}
          saving={saving}
          progress={recapProgress}
          aiPending={recapAIPendingKey !== null}
        />
      ) : null}

      {activeDraft?.cancelIntent ? (
        <SubscriptionCancelCard key={activeDraft.cancelIntent.serviceQuery} serviceQuery={activeDraft.cancelIntent.serviceQuery}
          onCancelled={() => { resetAll(); onOpenChange(false); }} />
      ) : activeDraft && transferIntent && receipt.status !== "scanning" && !recapMode ? (
        <div id="capture-transfer-details"><TransferPreview
          hideSave
          intent={transferIntent}
          accounts={accounts}
          amountCents={activeDraft.amountCents}
          date={activeDraft.date}
          fromId={transferSide("from")}
          toId={transferSide("to")}
          saving={saving}
          onAmountChange={(amountCents) => patchDraft({ amountCents })}
          onPick={(side, accountId, rememberWord) => {
            display.effort();
            setTransferPicks((previous) => ({
              ...(previous.key === textKey ? previous : { key: textKey }),
              [side]: accountId,
            }));
            if (!rememberWord) return;
            void saveAccountAlias(accountId, rememberWord, "learned").then((result) => {
              if (result.alias) {
                setAliases((previous) => [...previous.filter((alias) => alias.alias_normalized !== result.alias!.alias_normalized), result.alias!]);
                const accountName = accounts.find((account) => account.id === accountId)?.name ?? "";
                toast(t("capture.voice.remembered").replace("{heard}", rememberWord).replace("{name}", accountName));
              } else if (result.error) toast.error(result.error);
            });
          }}
          onSave={() => void save()}
        /></div>
      ) : activeDraft && receipt.status !== "scanning" && !recapMode && (receipt.status !== "idle" || activeDraft.smart || activeDraft.subscription || memoryNeedsConfirmation(activeDraft)) ? (
        <TransactionPreview
          draft={activeDraft}
          hideSave={!!pinnedDraft}
          detailsOnly={!!pinnedDraft}
          largeText={display.largeText}
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
              <p className="flex min-w-0 items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                <LiveStatus lines={tList("capture.aiAssistingSteps", "capture.aiAssisting")} />
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
      </details>
    </div>
  ) : null;

  return (
    <>
    <SlipAutoFlow ref={slipFlowRef} accounts={accounts} categories={categories} onTransfer={onTransfer} />
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
        data-testid="capture-layout"
        data-layout={captureDisplayLayout}
        data-large-text={display.largeText}
        motion="grow"
        side="bottom"
        className="[&_button]:min-h-11 [&_button]:min-w-11 [&_select]:min-h-11 [&_input:not([type=checkbox])]:min-h-11 [&_label:has(input[type=checkbox])]:min-h-11 flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-3xl p-0 pb-[calc(env(safe-area-inset-bottom)+12px)] [&>[data-slot=sheet-close]]:size-11 motion-reduce:transition-none sm:mx-auto sm:max-w-lg"
        // iOS overlays the keyboard instead of resizing the page — lift the
        // sheet above it. While the keyboard is up the sheet takes ALL the
        // space above it (a fixed height, not its content's), so typing the
        // first letter — which adds the preview card — never makes the sheet
        // grow and its top jump. It glides with the keyboard (transition).
        style={
          captureDisplayLayout === "b" && captureViewport
            ? {
                top: captureViewport.offsetTop,
                bottom: "auto",
                height: captureViewport.height,
                maxHeight: captureViewport.height,
                paddingBottom: 12,
              }
            : speech.listening && holdLayout
              ? { height: holdLayout.sheetHeight, maxHeight: holdLayout.sheetHeight }
              : undefined
        }
      >
        {/* Grab handle: the visual cue that the sheet can be pulled down to close. */}
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="shrink-0 pt-2 pb-2">
          <SheetTitle className="text-lg">{t("capture.title")}</SheetTitle>
          <details className="absolute right-14 top-3 z-20">
            <summary aria-label="เมนูหน้าจด" className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border">···</summary>
            <div className="absolute right-0 top-12 w-64 max-w-[80vw] space-y-2 rounded-2xl border bg-background p-3 shadow-lg"><CaptureLargeTextToggle enabled={display.largeText} disabled={!display.ready} onChange={display.setLargeText} /><button type="button" onClick={openManual} className="min-h-11 w-full text-left">แก้ไขรายละเอียด</button></div>
          </details>
          <SheetDescription>{t("capture.subtitle")}</SheetDescription>
        </SheetHeader>

        {(pinnedDraft || recapMode || (speech.listening && holdLayout?.reviewHeight)) ? <div ref={pinnedReviewRef} className="shrink-0 px-4 pb-2" style={speech.listening && holdLayout ? { height: holdLayout.reviewHeight, overflow: "hidden" } : undefined}>{pinnedDraft && <CaptureReviewCard draft={pinnedDraft} accounts={accounts} categories={categories} largeText={display.largeText} compact={captureDisplayLayout === "b"} unsure={unsure && captureDisplayLayout !== "b"} text={textKey} today={ctx.today}
          transfer={transferIntent ? { label: `${accounts.find(a => a.id === transferSide("from"))?.name ?? "เลือกบัญชีต้นทาง"} → ${accounts.find(a => a.id === transferSide("to"))?.name ?? "เลือกบัญชีปลายทาง"}`, onEdit: () => document.getElementById("capture-transfer-details")?.scrollIntoView({ block: "nearest" }) } : undefined}
          suggestion={captureSuggestion}
          onEditText={() => textRef.current?.focus({ preventScroll: true })} onExpand={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }}
          onAnswer={answer => { display.effort(); display.remember(textKey, answer); }} onChange={patchDraft}
          onSave={() => void save({ deferUnsure: unsure })} disabled={pinnedSaveDisabled} saving={saving} />}{batchReview}</div> : null}
        {!pinnedDraft && !recapMode && captureSuggestion && <div className="shrink-0 px-4 pb-2">{captureSuggestion}</div>}
        <div ref={scrollRef} className="journal-page edge-fade-y min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 px-4">
            <div
              ref={prefixRef}
              className="space-y-3"
              // Keep everything above the held mic at its press-time height,
              // including when an earlier review moves below it for a new take.
              style={speech.listening && holdLayout ? { height: holdLayout.prefixHeight, overflow: "hidden" } : undefined}
            >
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
                  data-capture-paper
                  id="quick-capture-input"
                  ref={attachText}
                  rows={1}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setTextSource("quick_text");
                    setOverrides({});
                    setTransferPicks({ key: "" });
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
                  className={cn(handFont.className, "voice-paper-field block min-h-13 w-full resize-none overflow-y-auto overscroll-contain border-0 bg-transparent px-4 py-3 pr-12 text-[26px] leading-8 text-[#1f3d6b] outline-none dark:text-[#9db8e6]")}
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
                    className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </form>

              {!display.largeText && <CaptureDatePicker value={captureDate} today={ctx.today} onChange={(d) => { display.effort(); setPickedDate(d === ctx.today ? null : d); }} />}

              {reviewFirst ? review : null}

              {/* Examples fold away smoothly once typing starts (no one-frame jump). */}
              <div
                aria-hidden={Boolean(text) || receipt.status !== "idle"}
                inert={Boolean(text) || receipt.status !== "idle" || speech.listening}
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
                        // A stray tap left over from pressing the mic is not a choice.
                        if (speech.listening || Date.now() - micPressedAtRef.current < 800) return;
                        setText(t(`capture.${key}`));
                        setTextSource("quick_text");
                      }}
                      className="min-h-11 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t(`capture.${key}`)}
                    </button>
                  ))}
                </div>
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
                largeText={display.largeText}
                listening={speech.listening}
                disabled={!speech.supported}
                onStart={() => {
                  micPressedAtRef.current = Date.now();
                  setHoldLayout({
                    prefixHeight: prefixRef.current?.getBoundingClientRect().height ?? 0,
                    sheetHeight: sheetElRef.current?.getBoundingClientRect().height ?? 0,
                    reviewHeight: pinnedReviewRef.current?.getBoundingClientRect().height ?? 0,
                  });
                  setError(null);
                  if (receipt.status !== "idle") clearReceipt();
                  textRef.current?.blur();
                  // A new recording is a new recap (reported 2026-10-05: old,
                  // unrelated text was pulled into the fresh one) — no need to
                  // tap X first.
                  setText("");
                  setOverrides({});
                  setRecapOverrides({});
                  setRecapRemoved(new Set());
                  setRecapAI({});
                  if (text.trim() || hasRecorded.current) display.effort();
                  hasRecorded.current = true;
                  speech.startHold("");
                }}
                onStop={() => {
                  micPressedAtRef.current = Date.now();
                  speech.stopHold();
                }}
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
            {/* Not hidden while listening: removing it re-laid out the sheet
                under the finger that just pressed the mic. */}
            {speech.supported ? <MicPermissionTip /> : null}
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
              multiple
              accept="image/*"
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                handleImages(files);
              }}
            />
            <button
              type="button"
              onClick={() => { speech.stop(); onOpenChange(false); slipFlowRef.current?.start(); }}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ImageUp className="size-3.5" aria-hidden="true" />
              {t("capture.uploadImage")}
            </button>

            {!reviewFirst ? review : null}

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
        {captureDisplayLayout === "b" && (pinnedDraft || recapMode) && <div className="shrink-0 bg-background px-4 pt-2"><CaptureSaveButton onSave={() => recapMode ? void confirmRecap() : void save({ deferUnsure: unsure })} disabled={recapMode ? batchSaveDisabled : pinnedSaveDisabled} saving={saving} largeText={display.largeText} pending={unsure} /></div>}
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
