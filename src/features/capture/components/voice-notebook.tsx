"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, Keyboard, Mic, MoreHorizontal, Search, X } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/financial/money";
import { toLocalDateString } from "@/lib/date";
import { handFont } from "@/components/notebook/hand-font";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { SuccessBadge } from "@/components/illustrations";
import { cheerCompanion } from "@/features/companions/presence";
import { createTransfer, deleteTransaction } from "@/features/transactions/actions";
import { getAccountAliases, saveAccountAlias, type AccountAlias } from "@/features/accounts/actions";
import { getCapturePreferences, saveCapturedTransaction } from "@/features/capture/actions";
import type { CaptureMerchantPreference, ParseContext } from "@/lib/capture/transaction-parser";
import { parseRecap } from "@/lib/capture/recap";
import { detectTransferIntent, type AccountSlot, type TransferIntent } from "@/lib/capture/transfer";
import { buildCaptureSaveInput, canSaveDraft, type CaptureDraft } from "@/lib/capture/draft";

interface VoiceNotebookProps {
  open: boolean;
  onClose: () => void;
  /** What has been heard so far (owned by QuickAdd, which also owns the mic). */
  transcript: string;
  /** The user typed on the paper: their text replaces the transcript. */
  onTranscriptChange: (text: string) => void;
  listening: boolean;
  micError: string | null;
  onMicStart: () => void;
  onMicStop: () => void;
  accounts: Account[];
  categories: Category[];
  /** "More" (header): hand the words over to the full Quick Capture sheet — slips, income, transfer. */
  onMore: (text: string) => void;
}

interface Row {
  id: string;
  draft: CaptureDraft;
  /** "โอนเงินจาก Cash ไป Dime 3000": a move between the user's own accounts, saved as a transfer. */
  transfer: TransferIntent | null;
}

type Side = "from" | "to";

/** The account picker sheet: which row and side it fills, and the word that was heard there. */
interface PickerTarget {
  rowId: string;
  side: Side;
  heard: string | null;
  excludeId: string | null;
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
  onTranscriptChange,
  listening,
  micError,
  onMicStart,
  onMicStop,
  accounts,
  categories,
  onMore,
}: VoiceNotebookProps) {
  const { t, locale } = useTranslation();
  const keyboardInset = useKeyboardInset(open);
  // The handwriting IS a text box: tapping a word puts the caret right
  // there and opens the keyboard (a real tap on the field is what lets
  // iOS show it), so corrections happen on the paper itself.
  const paperRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [transcript, open]);
  const [preferences, setPreferences] = useState<CaptureMerchantPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdsRef = useRef<Record<string, string>>({});
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isClient, setIsClient] = useState(false);
  // Accounts the user tapped for a transfer side the words didn't settle.
  const [picks, setPicks] = useState<Record<string, Partial<Record<Side, string>>>>({});
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  // Nicknames the user gave their accounts ("กระปุกหมู" → a savings account).
  const [aliases, setAliases] = useState<AccountAlias[]>([]);
  const [rememberAlias, setRememberAlias] = useState(true);
  const pickerRef = useRef<PickerTarget | null>(null);
  useEffect(() => {
    pickerRef.current = picker;
  }, [picker]);

  useEffect(() => {
    // Portal target only exists on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setPicks({});
    setPicker(null);
    closeRef.current?.focus();
    let cancelled = false;
    getCapturePreferences()
      .then((prefs) => {
        if (!cancelled) setPreferences(prefs);
      })
      .catch(() => {});
    getAccountAliases()
      .then((rows) => {
        if (!cancelled) setAliases(rows);
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The account sheet closes first, then the page.
      if (pickerRef.current) setPicker(null);
      else onClose();
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
  const aliasedAccounts = useMemo(
    () => accounts.map((a) => ({ ...a, aliases: aliases.filter((x) => x.account_id === a.id).map((x) => x.alias_normalized) })),
    [accounts, aliases]
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
      transfer: detectTransferIntent(item.sourceText, aliasedAccounts),
    }));
  }, [parseText, ctx, aliasedAccounts]);
  /** A transfer side's account: the user's tap wins, then a match from the words; null = still to pick. */
  const sideAccount = (row: Row, side: Side): string | null => {
    const slot = row.transfer?.[side];
    return picks[row.id]?.[side] ?? (slot?.status === "matched" ? slot.accountId : null);
  };
  const transferReady = (row: Row) => {
    const from = sideAccount(row, "from");
    const to = sideAccount(row, "to");
    return from !== null && to !== null && from !== to;
  };
  const unresolved = rows.filter((r) => r.transfer && r.draft.amountCents !== null && !transferReady(r)).length;
  const saveable = rows.filter((r) => (r.transfer ? r.draft.amountCents !== null && transferReady(r) : canSaveDraft(r.draft)));

  function pick(rowId: string, side: Side, accountId: string, learnWord: string | null = null) {
    setPicks((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [side]: accountId } }));
    setPicker(null);
    if (!learnWord) return;
    // "Remember this name" was ticked: next time the word alone is enough.
    saveAccountAlias(accountId, learnWord, "learned")
      .then((result) => {
        const saved = result.alias;
        if (saved) {
          setAliases((prev) => [...prev.filter((a) => a.alias_normalized !== saved.alias_normalized), saved]);
          toast(t("capture.voice.remembered").replace("{heard}", learnWord).replace("{name}", accountName(accountId) ?? ""));
        } else if (result.error) toast.error(result.error);
      })
      .catch(() => {});
  }
  function openPicker(row: Row, side: Side) {
    const slot = row.transfer?.[side];
    const other = sideAccount(row, side === "from" ? "to" : "from");
    setPickerQuery("");
    setRememberAlias(true);
    setPicker({ rowId: row.id, side, heard: slot && slot.status !== "matched" ? slot.heard : null, excludeId: other });
  }
  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const pickerAccounts = picker
    ? activeAccounts.filter(
        (a) => a.id !== picker.excludeId && (!pickerQuery.trim() || a.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
      )
    : [];

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
      const fromId = sideAccount(row, "from");
      const toId = sideAccount(row, "to");
      if (row.transfer && row.draft.amountCents !== null && fromId && toId) {
        // Same server action (and idempotency key) as the manual transfer form.
        const form = new FormData();
        form.set("from_account_id", fromId);
        form.set("to_account_id", toId);
        form.set("amount", (row.draft.amountCents / 100).toFixed(2));
        form.set("transaction_date", row.draft.date);
        form.set("client_request_id", requestId);
        try {
          const result = await createTransfer(undefined, form);
          if (result.success) {
            saved += 1;
            lastAmount = row.draft.amountCents;
            if (result.transactionId) savedIds.push(result.transactionId);
            delete requestIdsRef.current[row.id];
          } else failed += 1;
        } catch {
          failed += 1;
        }
        continue;
      }
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
      // iOS lays the keyboard over the page: lift the buttons above it.
      style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}
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
        <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onMore(transcript)}
          aria-label={t("capture.voice.more")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/5 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </button>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("capture.voice.close")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/5 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto pt-8 pr-5 pb-4 pl-16">
        <textarea
          ref={paperRef}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          // Typing and dictating at once would fight over the text.
          onFocus={() => {
            if (listening) onMicStop();
          }}
          rows={1}
          placeholder={t("capture.voice.placeholder")}
          aria-label={t("capture.voice.paperLabel")}
          className={cn(
            handFont.className,
            "block min-h-20 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[clamp(1.6rem,7.5vw,2.1rem)] leading-snug break-words",
            "text-[#1f3d6b] caret-[#1f3d6b] placeholder:text-muted-foreground/70 focus:outline-none dark:text-[#9db8e6] dark:caret-[#9db8e6]",
            // A faint highlighter band shows the line is being edited.
            "rounded-sm focus:bg-[var(--journal-highlight)]/25"
          )}
        />

        {rows.length > 0 ? (
          <ul className="mt-6 flex flex-col gap-3">
            {rows.map((row, i) => {
              const d = row.draft;
              const tr = row.transfer;
              const details = tr
                ? null
                : [categoryName(d.categoryId), accountName(d.accountId), dayLabel(d.date)].filter(Boolean).join(" · ");
              const needsPick = tr !== null && !transferReady(row);
              /** A side the user hasn't tapped yet, as the words left it. */
              const openSlot = (side: Side): AccountSlot | null => (tr && !picks[row.id]?.[side] ? tr[side] : null);
              const accountChip = (side: Side) => {
                const id = sideAccount(row, side);
                return (
                  <button
                    type="button"
                    onClick={() => openPicker(row, side)}
                    aria-label={side === "from" ? t("capture.voice.changeFrom") : t("capture.voice.changeTo")}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-full border px-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      id
                        ? "border-[#e3d5b8] bg-white/60 text-foreground dark:border-white/15 dark:bg-white/5"
                        : "border-dashed border-amber-600 text-amber-800 dark:border-amber-400 dark:text-amber-300"
                    )}
                  >
                    {accountName(id) ?? t("capture.voice.pickAccount")}
                  </button>
                );
              };
              return (
                <li
                  key={row.id}
                  className={cn(
                    "self-start rounded-md border border-[#e3d5b8] bg-[#fffaf0] px-4 py-3 shadow-[0_6px_14px_rgba(60,40,10,0.12)] dark:border-white/10 dark:bg-card",
                    needsPick ? "border-amber-500 dark:border-amber-400" : i % 2 === 0 ? "-rotate-1" : "rotate-[0.6deg]",
                    "min-w-[14rem] max-w-full motion-reduce:rotate-0"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        tr
                          ? "text-sky-700 dark:text-sky-400"
                          : d.type === "income"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                      )}
                    >
                      {tr ? t("capture.voice.transfer") : d.type === "income" ? t("capture.voice.income") : t("capture.voice.expense")}
                    </span>
                    {d.amountCents !== null ? (
                      <span className="text-xl font-bold tabular-nums">{formatMoney(d.amountCents)}</span>
                    ) : (
                      <span className="text-sm text-amber-700 dark:text-amber-400">{t("capture.voice.noAmount")}</span>
                    )}
                  </div>
                  {details ? <p className="mt-1 text-sm text-muted-foreground">{details}</p> : null}
                  {tr ? (
                    <>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        {accountChip("from")}
                        <span aria-hidden="true">→</span>
                        {accountChip("to")}
                        <span>· {dayLabel(d.date)}</span>
                      </div>
                      {(["from", "to"] as const).map((side) => {
                        const slot = openSlot(side);
                        if (slot?.status === "matched" && slot.heard) {
                          // Matched by sound, not by name: show what was heard so a wrong match is obvious.
                          return (
                            <p key={side} className="mt-2 flex items-center gap-1.5 border-t border-dashed border-[#e3d5b8] pt-2 text-sm text-muted-foreground dark:border-white/15">
                              <Check className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                              {t("capture.voice.heardAs").replace("{heard}", slot.heard).replace("{name}", accountName(slot.accountId) ?? "")}
                            </p>
                          );
                        }
                        if (slot?.status === "ambiguous") {
                          return (
                            <div key={side} className="mt-2 border-t border-dashed border-[#e3d5b8] pt-2 dark:border-white/15">
                              <p className="text-sm font-semibold">{t("capture.voice.whichAccount").replace("{heard}", slot.heard)}</p>
                              <div className="mt-2 flex flex-col gap-1.5">
                                {slot.candidates.map((id) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => pick(row.id, side, id)}
                                    className="min-h-11 rounded-xl border border-[#cdbf9f] bg-white px-3 text-left text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/20 dark:bg-white/5"
                                  >
                                    {accountName(id)}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => openPicker(row, side)}
                                  className="min-h-11 rounded-xl border border-dashed border-[#cdbf9f] px-3 text-left text-[15px] font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/20"
                                >
                                  {t("capture.voice.otherAccount")}
                                </button>
                              </div>
                            </div>
                          );
                        }
                        if (slot?.status === "unknown" && slot.heard) {
                          return (
                            <p key={side} className="mt-2 border-t border-dashed border-[#e3d5b8] pt-2 text-sm text-amber-800 dark:border-white/15 dark:text-amber-300">
                              {t("capture.voice.unknownAccount").replace("{heard}", slot.heard)}
                            </p>
                          );
                        }
                        return null;
                      })}
                    </>
                  ) : null}
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
        {/* While typing (keyboard up) the big mic steps aside for the text. */}
        <div className={cn("relative size-36 items-center justify-center", keyboardInset ? "hidden" : "flex")}>
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
        {unresolved > 0 ? (
          <p className="-mt-2 text-center text-sm text-amber-800 dark:text-amber-300">
            {t("capture.voice.needsPick").replace("{n}", String(unresolved))}
          </p>
        ) : null}
        <div className="flex w-full max-w-md gap-3">
          <button
            type="button"
            onClick={() => {
              // Focus inside the tap itself, so iOS opens the keyboard.
              const el = paperRef.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(el.value.length, el.value.length);
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#cdbf9f] text-base font-semibold transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/20"
          >
            <Keyboard className="size-5" aria-hidden="true" />
            {t("capture.voice.type")}
          </button>
          <button
            type="button"
            onClick={() => void saveAll()}
            // A transfer whose account isn't settled is never saved half-done or skipped silently.
            disabled={saving || saveable.length === 0 || unresolved > 0}
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

      {picker ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t("capture.voice.close")}
            onClick={() => setPicker(null)}
            className="absolute inset-0 bg-black/45 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-account-picker-title"
            className="relative max-h-[80%] overflow-y-auto rounded-t-3xl bg-[#fffaf0] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-10px_30px_rgba(20,28,24,0.25)] animate-in slide-in-from-bottom-8 duration-200 motion-reduce:animate-none dark:bg-card"
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#d9ccb0] dark:bg-white/20" />
            <h3 id="voice-account-picker-title" className="text-xl font-semibold">
              {picker.heard
                ? t("capture.voice.pickerHeard").replace("{heard}", picker.heard)
                : picker.side === "from"
                  ? t("capture.voice.pickerFrom")
                  : t("capture.voice.pickerTo")}
            </h3>
            {picker.heard ? (
              // Set before tapping an account: the tap itself picks and (if ticked) remembers.
              <label className="mt-3 flex items-start gap-3 rounded-xl bg-primary/5 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={rememberAlias}
                  onChange={(e) => setRememberAlias(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  {t("capture.voice.pickerRemember").replace("{heard}", picker.heard)}
                  <span className="block text-muted-foreground">{t("capture.voice.pickerRememberHint")}</span>
                </span>
              </label>
            ) : null}
            {activeAccounts.length > 6 ? (
              <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-[#d9ccb0] bg-white px-3 dark:border-white/15 dark:bg-white/5">
                <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t("capture.voice.pickerSearch")}
                  aria-label={t("capture.voice.pickerSearch")}
                  className="min-w-0 flex-1 bg-transparent text-base focus:outline-none"
                />
              </label>
            ) : null}
            <ul className="mt-3 flex flex-col gap-1.5">
              {pickerAccounts.map((a) => {
                const pickerRow = rows.find((r) => r.id === picker.rowId);
                const selected = pickerRow ? sideAccount(pickerRow, picker.side) === a.id : false;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pick(picker.rowId, picker.side, a.id, picker.heard && rememberAlias ? picker.heard : null)}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-2 border-primary bg-primary/5" : "border-[#e3d5b8] bg-white dark:border-white/15 dark:bg-white/5"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{a.name}</span>
                        <span className="block text-[13px] text-muted-foreground">
                          {[t(`accounts.types.${a.account_type}`), a.institution]
                            .filter((part) => part && part !== a.name)
                            .join(" · ")}
                        </span>
                      </span>
                      {selected ? <Check className="size-5 shrink-0 text-primary" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
              {pickerAccounts.length === 0 ? <li className="py-4 text-center text-sm text-muted-foreground">{t("capture.voice.pickerEmpty")}</li> : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
