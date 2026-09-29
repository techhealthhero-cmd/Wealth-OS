"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftRight, Camera, ImageUp, Loader2, Mic, PencilLine, TrendingUp, X } from "lucide-react";

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
import {
  defaultAccountId,
  matchAccount,
  parseCaptureText,
  suggestCategory,
  type CaptureMerchantPreference,
  type ParseContext,
} from "@/lib/capture/transaction-parser";
import { buildCaptureSaveInput, type CaptureDraft } from "@/lib/capture/draft";
import type { ReceiptExtraction } from "@/lib/capture/receipt-normalize";
import type { TransactionPrefill } from "@/features/transactions/components/transaction-form";
import { deleteTransaction } from "@/features/transactions/actions";
import { createRecurringTransaction } from "@/features/recurring/actions";
import {
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
  const textRef = useRef<HTMLInputElement>(null);

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

  const textDraft: CaptureDraft | null = useMemo(() => {
    if (!text.trim()) return null;
    const parsed = parseCaptureText(text, ctx);
    return {
      type: parsed.type,
      amountCents: parsed.amountCents,
      categoryId: parsed.categoryId,
      categorySource: parsed.categorySource,
      accountId: parsed.accountId,
      merchant: parsed.merchant,
      description: parsed.description,
      date: parsed.date,
      confidence: parsed.confidence,
      source: textSource,
      categoryConfirmedByUser: false,
      ...overrides,
    };
  }, [text, ctx, textSource, overrides]);

  const activeDraft = receipt.status !== "idle" ? receiptDraft : textDraft;

  function resetAll() {
    setText("");
    setTextSource("quick_text");
    setOverrides({});
    setReceipt({ status: "idle" });
    setReceiptDraft(null);
    setDuplicate(null);
    setError(null);
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
      const formData = new FormData();
      formData.append("image", prepared);
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
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) speech.stop();
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-3xl p-0 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:mx-auto sm:max-w-lg"
        // iOS overlays the keyboard instead of resizing the page — lift the
        // sheet above it and cap its height to the space left visible.
        style={
          keyboardInset > 0
            ? { bottom: keyboardInset, maxHeight: `calc(100dvh - ${keyboardInset}px - 1rem)`, paddingBottom: 12 }
            : undefined
        }
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">{t("capture.title")}</SheetTitle>
          <SheetDescription>{t("capture.subtitle")}</SheetDescription>
        </SheetHeader>

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
            <input
              id="quick-capture-input"
              ref={textRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setTextSource("quick_text");
                setOverrides({});
                setError(null);
                if (receipt.status !== "idle") clearReceipt();
              }}
              placeholder={speech.listening ? t("capture.listening") : t("capture.inputPlaceholder")}
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              className="h-13 w-full rounded-2xl border bg-background px-4 pr-11 text-base outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
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
                className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </form>

          {!text && receipt.status === "idle" ? (
            <div className="flex flex-wrap gap-1.5">
              {(["example1", "example2", "example3"] as const).map((key) => (
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
          ) : null}

          {/* Capture methods */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => speech.toggle()}
              disabled={!speech.supported}
              aria-pressed={speech.listening}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 text-xs font-medium transition-colors disabled:opacity-50",
                speech.listening ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <Mic className={cn("size-5", speech.listening && "animate-pulse")} aria-hidden="true" />
              {speech.listening ? t("capture.stopListening") : t("capture.speak")}
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 text-xs font-medium hover:bg-muted"
            >
              <Camera className="size-5" aria-hidden="true" />
              {t("capture.scan")}
            </button>
            <button
              type="button"
              onClick={openManual}
              className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 text-xs font-medium hover:bg-muted"
            >
              <PencilLine className="size-5" aria-hidden="true" />
              {t("capture.manual")}
            </button>
          </div>
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

          {activeDraft && receipt.status !== "scanning" ? (
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
      </SheetContent>
    </Sheet>
  );
}
