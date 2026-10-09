"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Mic, X } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { handFont } from "@/components/notebook/hand-font";
import { SuccessBadge } from "@/components/illustrations";
import { cheerCompanion } from "@/features/companions/presence";
import { deleteTransaction } from "@/features/transactions/actions";
import { getCapturePreferences, saveCapturedTransaction } from "@/features/capture/actions";
import type { CaptureMerchantPreference, ParseContext } from "@/lib/capture/transaction-parser";
import { parseRecap } from "@/lib/capture/recap";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";

interface VoiceNotebookProps {
  open: boolean;
  onClose: () => void;
  /** What has been heard so far (owned by QuickAdd, which also owns the mic). */
  transcript: string;
  listening: boolean;
  micError: string | null;
  onMicStart: () => void;
  onMicStop: () => void;
  accounts: Account[];
  categories: Category[];
  /** "แก้ไข / พิมพ์เอง": hand the words over to the full Quick Capture sheet. */
  onEdit: (text: string) => void;
}

interface Row {
  id: string;
  draft: CaptureDraft;
}

/**
 * Voice capture as a journal page (chosen mockup, 2026-10-10): the center
 * mic opens it already listening, the words are written onto the ruled
 * page by hand, and each priced item they contain is pinned below as a
 * note to check before saving. Parsing is the same deterministic recap
 * parser Quick Capture uses (no AI, no amounts invented); saving goes
 * through the same idempotent saveCapturedTransaction. Anything to fix is
 * one tap away in the full sheet ("แก้ไข / พิมพ์เอง").
 */
export function VoiceNotebook({
  open,
  onClose,
  transcript,
  listening,
  micError,
  onMicStart,
  onMicStop,
  accounts,
  categories,
  onEdit,
}: VoiceNotebookProps) {
  const { t, locale } = useTranslation();
  const [preferences, setPreferences] = useState<CaptureMerchantPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdsRef = useRef<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Portal target only exists on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    closeRef.current?.focus();
    let cancelled = false;
    getCapturePreferences()
      .then((prefs) => {
        if (!cancelled) setPreferences(prefs);
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const today = toLocalDateString(new Date());
  const ctx: ParseContext = useMemo(
    () => ({ accounts, categories, merchantPreferences: preferences, today }),
    [accounts, categories, preferences, today]
  );
  // Parsing trails live dictation at low priority, so the writing stays smooth.
  const parseText = useDeferredValue(transcript);
  const rows: Row[] = useMemo(() => {
    if (!parseText.trim()) return [];
    return parseRecap(parseText, ctx).map((item, i) => ({
      id: `${i}:${item.sourceText}`,
      draft: {
        type: item.type,
        amountCents: item.amountCents,
        categoryId: item.categoryId,
        categorySource: item.categorySource,
        accountId: item.accountId,
        merchant: item.merchant,
        description: item.description,
        date: item.date,
        confidence: item.confidence,
        source: "voice",
        categoryConfirmedByUser: false,
      },
    }));
  }, [parseText, ctx]);
  const saveable = rows.filter((r) => canSaveDraft(r.draft));

  const dateFormat = locale === "th" ? "th-TH" : "en-US";
  const headerDate = new Intl.DateTimeFormat(dateFormat, { weekday: "long", day: "numeric", month: "short" }).format(new Date());
  const dayLabel = (iso: string) =>
    iso === today
      ? t("capture.voice.today")
      : new Intl.DateTimeFormat(dateFormat, { day: "numeric", month: "short" }).format(new Date(`${iso}T00:00:00`));
  const categoryName = (id: string | null) => {
    const c = id ? categories.find((x) => x.id === id) : undefined;
    return c ? (locale === "th" ? c.name_th : c.name_en) : null;
  };
  const accountName = (id: string | null) => (id ? (accounts.find((a) => a.id === id)?.name ?? null) : null);

  const micMessage =
    micError === "not-allowed" || micError === "service-not-allowed"
      ? t("capture.voice.micBlocked")
      : micError
        ? t("capture.voice.micError")
        : null;

  /** Same rules as Quick Capture's recap confirm: one idempotency key per item, blind "Other" guesses go to the Daily Inbox. */
  async function saveAll() {
    if (saving || saveable.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(t("capture.offline"));
      return;
    }
    if (listening) onMicStop();
    setSaving(true);
    setError(null);
    const savedIds: string[] = [];
    let saved = 0;
    let needsReview = 0;
    let failed = 0;
    let lastAmount = 0;
    for (const row of saveable) {
      const requestId = (requestIdsRef.current[row.id] ??= crypto.randomUUID());
      const reviewed = row.draft.categorySource !== "fallback" && row.draft.categoryId !== null;
      const payload = buildCaptureSaveInput({ ...row.draft, categoryConfirmedByUser: reviewed }, requestId);
      try {
        const result = payload ? await saveCapturedTransaction(payload) : null;
        if (result?.success) {
          saved += 1;
          lastAmount = payload!.amountCents;
          if (result.transactionId) savedIds.push(result.transactionId);
          delete requestIdsRef.current[row.id];
          if (!reviewed) needsReview += 1;
        } else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setSaving(false);

    if (saved > 0) {
      cheerCompanion();
      const message =
        saved === 1
          ? `${needsReview ? t("capture.savedNeedsReview") : t("capture.saved")} ${formatMoney(lastAmount)}`
          : t("capture.recap.saved").replace("{n}", String(saved));
      toast.success(message, {
        icon: <SuccessBadge />,
        description:
          saved > 1 && needsReview > 0 ? t("capture.recap.savedReview").replace("{n}", String(needsReview)) : undefined,
        action: savedIds.length
          ? {
              label: t("capture.undo"),
              onClick: async () => {
                const results = await Promise.all(savedIds.map((id) => deleteTransaction(id)));
                if (results.every((r) => r.success)) toast(t("capture.undone"));
                else toast.error(t("capture.saveFailed"));
              },
            }
          : undefined,
      });
    }
    if (failed > 0) {
      setError(t("capture.recap.partialFailed").replace("{n}", String(failed)));
      return;
    }
    onClose();
  }

  if (!isClient || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-notebook-title"
      className="journal-page fixed inset-0 z-[60] flex flex-col overflow-hidden bg-background text-foreground animate-in fade-in-0 slide-in-from-bottom-6 duration-300 motion-reduce:animate-none"
    >
      {/* Red margin line of a ruled notebook page. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-12 w-px bg-[rgba(194,65,45,0.35)]" />

      <header className="relative flex items-center justify-between gap-3 pt-[calc(env(safe-area-inset-top)+1rem)] pr-4 pl-16">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{headerDate}</p>
          <h2 id="voice-notebook-title" className="text-xl font-semibold">
            {t("capture.voice.title")}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("capture.voice.close")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/5 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto pt-8 pr-5 pb-4 pl-16">
        <p
          aria-live="polite"
          className={cn(
            handFont.className,
            "min-h-20 text-[clamp(1.6rem,7.5vw,2.1rem)] leading-snug break-words",
            transcript ? "text-[#1f3d6b] dark:text-[#9db8e6]" : "text-muted-foreground/70"
          )}
        >
          {transcript || t("capture.voice.placeholder")}
          {listening ? (
            <span aria-hidden="true" className="ml-1 inline-block h-[0.9em] w-0.5 animate-pulse bg-current align-[-0.1em]" />
          ) : null}
        </p>

        {rows.length > 0 ? (
          <ul className="mt-6 flex flex-col gap-3">
            {rows.map((row, i) => {
              const d = row.draft;
              const details = [categoryName(d.categoryId), accountName(d.accountId), dayLabel(d.date)].filter(Boolean).join(" · ");
              return (
                <li
                  key={row.id}
                  className={cn(
                    "self-start rounded-md border border-[#e3d5b8] bg-[#fffaf0] px-4 py-3 shadow-[0_6px_14px_rgba(60,40,10,0.12)] dark:border-white/10 dark:bg-card",
                    i % 2 === 0 ? "-rotate-1" : "rotate-[0.6deg]",
                    "min-w-[14rem] max-w-full motion-reduce:rotate-0"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className={cn("text-sm font-semibold", d.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
                      {d.type === "income" ? t("capture.voice.income") : t("capture.voice.expense")}
                    </span>
                    {d.amountCents !== null ? (
                      <span className="text-xl font-bold tabular-nums">{formatMoney(d.amountCents)}</span>
                    ) : (
                      <span className="text-sm text-amber-700 dark:text-amber-400">{t("capture.voice.noAmount")}</span>
                    )}
                  </div>
                  {details ? <p className="mt-1 text-sm text-muted-foreground">{details}</p> : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-5 space-y-2 text-sm">
          {accounts.length === 0 ? <p className="text-amber-700 dark:text-amber-400">{t("capture.voice.noAccount")}</p> : null}
          {micMessage ? <p className="text-destructive">{micMessage}</p> : null}
          {error ? <p className="text-destructive">{error}</p> : null}
          {!micMessage && !error ? (
            <p className="text-muted-foreground">
              {listening ? (rows.length > 0 ? t("capture.voice.keepTalking") : t("capture.voice.listening")) : t("capture.voice.paused")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-col items-center gap-5 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-10 before:h-10 before:bg-gradient-to-t before:from-background before:to-transparent">
        <div className="relative flex size-36 items-center justify-center">
          {listening ? (
            <>
              <span aria-hidden="true" className="absolute inset-0 rounded-full border border-[#c7a15c]/40 bg-[#c7a15c]/10 motion-safe:animate-ping [animation-duration:2s]" />
              <span aria-hidden="true" className="absolute inset-5 rounded-full bg-[#c7a15c]/20" />
            </>
          ) : null}
          <button
            type="button"
            onClick={listening ? onMicStop : onMicStart}
            aria-pressed={listening}
            aria-label={listening ? t("capture.voice.micStop") : t("capture.voice.micStart")}
            className={cn(
              "relative flex size-20 items-center justify-center rounded-full text-[var(--journal-leather-deep)] shadow-[0_0_0_3px_var(--journal-leather),0_10px_22px_rgba(20,30,20,0.35)]",
              "transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 motion-reduce:transition-none",
              listening && "scale-105"
            )}
            style={{ background: "radial-gradient(circle at 35% 28%, #f1d79a, #c9a052 58%, #9c7631)" }}
          >
            <Mic className="size-8" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
        <div className="flex w-full max-w-md gap-3">
          <button
            type="button"
            onClick={() => onEdit(transcript)}
            className="h-12 flex-1 rounded-2xl border border-[#cdbf9f] text-base font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/20"
          >
            {t("capture.voice.edit")}
          </button>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving || saveable.length === 0}
            className="h-12 flex-1 rounded-2xl bg-primary text-base font-semibold text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {saving
              ? t("capture.voice.saving")
              : saveable.length > 1
                ? t("capture.voice.save").replace("{n}", String(saveable.length))
                : t("capture.voice.saveOne")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
