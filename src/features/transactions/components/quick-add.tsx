"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeftRight, CircleMinus, CirclePlus, Plus, TrendingDown, TrendingUp } from "lucide-react";

import type { Account, Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/shared/icon-chip";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TransactionPrefill } from "./transaction-form";
import { getQuickAddOptions } from "@/features/transactions/actions";
import { asTrigger } from "@/lib/as-trigger";
import { useTranslation } from "@/i18n/client";
import { useSpeechInput } from "@/lib/speech/use-speech-input";

type QuickAddDialog = "expense" | "income" | "transfer" | null;

const loadTransactionForm = () => import("./transaction-form");
const loadTransferForm = () => import("./transfer-form");
const loadQuickCaptureSheet = () => import("@/features/capture/components/quick-capture-sheet");
const TransactionForm = dynamic(() => loadTransactionForm().then((module) => module.TransactionForm), { ssr: false });
const TransferForm = dynamic(() => loadTransferForm().then((module) => module.TransferForm), { ssr: false });
const QuickCaptureSheet = dynamic(() => loadQuickCaptureSheet().then((module) => module.QuickCaptureSheet), { ssr: false });
const loadVoiceNotebook = () => import("@/features/capture/components/voice-notebook");
const VoiceNotebook = dynamic(() => loadVoiceNotebook().then((module) => module.VoiceNotebook), { ssr: false });

interface QuickAddProps {
  accounts?: Account[];
  categories?: Category[];
  /**
   * "row" is 3 always-visible tiles (income/expense/transfer) instead of
   * one button behind a dropdown menu — same dialogs underneath.
   * "nav-center" renders an invisible-content trigger sized to fill a
   * bottom-nav cell — BottomNav draws the actual visible raised "+" circle
   * itself (same treatment as its tab bumps) and layers this underneath it
   * as the real click target, so the two move as one piece instead of a
   * separately-positioned floating button drifting out of sync with the
   * nav's own layout.
   */
  variant?: "nav-center" | "inline" | "row";
}

type PendingSwitch = { dialog: Exclude<QuickAddDialog, null>; amount: string } | null;

export function QuickAdd({ accounts = [], categories = [], variant = "inline" }: QuickAddProps) {
  const { t, locale } = useTranslation();
  const [activeDialog, setActiveDialog] = useState<QuickAddDialog>(null);
  // Voice notebook (the center mic). The recognizer lives HERE, not in the
  // lazily loaded notebook, so listening starts inside the tap itself —
  // iOS only lets speech recognition start from a user gesture.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMounted, setVoiceMounted] = useState(false);
  if (voiceOpen && !voiceMounted) setVoiceMounted(true);
  const [voiceText, setVoiceText] = useState("");
  // Late transcripts from a session that was already closed are ignored.
  const voiceActiveRef = useRef(false);
  const speech = useSpeechInput(locale, (text) => {
    if (voiceActiveRef.current) setVoiceText(text);
  });
  const [captureInitialText, setCaptureInitialText] = useState<string | null>(null);
  const [carryOverAmount, setCarryOverAmount] = useState<string | undefined>(undefined);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  // Mounted on first open and then KEPT mounted: unmounting on close cut off
  // the sheet's fold-into-"+" close animation (and its black-hole button).
  const [captureMounted, setCaptureMounted] = useState(false);
  if (captureOpen && !captureMounted) setCaptureMounted(true);
  const [liveOptions, setLiveOptions] = useState({ accounts, categories });
  const [loadedDialogs, setLoadedDialogs] = useState({ expense: false, income: false, transfer: false });
  // Set only by Quick Capture's "manual entry" hand-off; any other open
  // clears it so an unrelated later open never inherits captured values.
  const [manualPrefill, setManualPrefill] = useState<TransactionPrefill | null>(null);

  async function refreshNavOptions() {
    try {
      const options = await getQuickAddOptions();
      setLiveOptions(options);
    } catch {
      // Opening with the last known options is safer than blocking the UI;
      // the form still validates ownership server-side on submit.
    }
  }

  function openVoice() {
    voiceActiveRef.current = true;
    setVoiceText("");
    // Must stay synchronous inside the tap (see the speech hook above).
    speech.startHold("");
    setVoiceOpen(true);
    void refreshNavOptions();
  }

  const closeVoice = useCallback(() => {
    voiceActiveRef.current = false;
    speech.stopHold();
    setVoiceOpen(false);
    setVoiceText("");
    // stopHold is a stable-enough closure over refs; re-creating it per
    // render would re-run the notebook's open effect on every word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCapture(initialText: string | null = null) {
    setCaptureInitialText(initialText);
    setCaptureOpen(true);
    void refreshNavOptions();
  }

  useEffect(() => {
    if (variant !== "nav-center") return;
    const timer = window.setTimeout(() => void refreshNavOptions(), 900);
    const warm = () => {
      void loadQuickCaptureSheet();
      void loadVoiceNotebook();
    };
    const idleId = window.requestIdleCallback?.(warm);
    const fallbackId = idleId === undefined ? window.setTimeout(warm, 2500) : undefined;
    return () => {
      window.clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
    };
    // Initial background warm-up only; every actual open refreshes again.
  }, [variant]);

  // A fresh, direct open (FAB / dropdown item / tile) must never inherit an
  // amount left over from an earlier, unrelated switch.
  function openDialog(dialog: Exclude<QuickAddDialog, null>) {
    setLoadedDialogs((current) => (current[dialog] ? current : { ...current, [dialog]: true }));
    setCarryOverAmount(undefined);
    setManualPrefill(null);
    setActiveDialog(dialog);
  }

  // Lets someone who opened "add expense"/"add income"/"transfer" change
  // their mind to a different one of the three without retyping the
  // amount — see TransactionForm's onSwitchToTransfer and TransferForm's
  // onSwitchToTransaction. Setting `activeDialog` straight to the new
  // value would flip the old form's `open` prop to false and the new
  // form's to true in the SAME render, but they're separate sibling
  // components — nothing guarantees the old one's close() effect runs
  // before the new one's openForm() effect, and MinimizableFormProvider's
  // openForm() deliberately refuses to replace a still-active different
  // form (its usual protection against an unrelated navigation silently
  // discarding an in-progress draft elsewhere). So this closes first
  // (`activeDialog(null)`), and only opens the target once that close has
  // actually landed, via the effect below reacting on the NEXT render —
  // two separate commits, so ordering between forms never matters.
  function requestSwitch(dialog: Exclude<QuickAddDialog, null>, amount: string) {
    setManualPrefill(null);
    setPendingSwitch({ dialog, amount });
    setActiveDialog(null);
  }

  useEffect(() => {
    if (!pendingSwitch) return;
    // Deliberately synchronous: this MUST land as a render strictly after
    // the one that closed the previous form, not be folded into it — see
    // requestSwitch's comment for why that separation is the whole point.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarryOverAmount(pendingSwitch.amount);
    setLoadedDialogs((current) =>
      current[pendingSwitch.dialog] ? current : { ...current, [pendingSwitch.dialog]: true }
    );
    setActiveDialog(pendingSwitch.dialog);
    setPendingSwitch(null);
  }, [pendingSwitch]);

  return (
    <>
      {variant === "row" ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              // Requested (2026-09-29): expense first — it's the most
              // frequent entry, so it gets the leading tile.
              { dialog: "expense" as const, icon: CircleMinus, tone: "rose" as const, label: t("transactions.types.expense") },
              { dialog: "income" as const, icon: CirclePlus, tone: "mint" as const, label: t("transactions.types.income") },
              { dialog: "transfer" as const, icon: ArrowLeftRight, tone: "lavender" as const, label: t("transactions.types.transfer") },
            ]
          ).map((item) => (
            <button
              key={item.dialog}
              type="button"
              onPointerDown={() => {
                if (item.dialog === "transfer") void loadTransferForm();
                else void loadTransactionForm();
              }}
              onClick={() => openDialog(item.dialog)}
              className={cn(
                "card-interactive flex flex-col items-center gap-2 rounded-xl bg-card py-4 text-card-foreground shadow-card ring-1 ring-foreground/5",
                "transition-colors hover:bg-accent/50"
              )}
            >
              <IconChip icon={item.icon} tone={item.tone} className="size-10" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      ) : variant === "nav-center" ? (
        // The center "+" now opens Quick Capture ("capture first, organize
        // later") instead of the Expense/Income/Transfer menu — that menu's
        // three options all remain inside the sheet (manual entry, income,
        // transfer). Invisible on purpose — BottomNav renders the visible
        // raised "+" circle above this exact spot; this is only the real
        // click target, sized like a normal nav cell.
        <button
          type="button"
          onPointerDown={() => void (speech.supported ? loadVoiceNotebook() : loadQuickCaptureSheet())}
          onClick={() => {
            // The center button is a mic (2026-10-10): it opens the voice
            // notebook already listening. Where the browser has no speech
            // recognition it falls back to Quick Capture (typing), so it
            // is never a dead button.
            if (speech.supported) openVoice();
            else openCapture();
          }}
          // `data-fab-trigger`: BottomNav's visible circle watches this
          // button's :active state to play its press animation. The
          // `before:` disc extends the hit area up over the part of the
          // circle that floats above the bar, so the whole "+" is tappable.
          data-fab-trigger=""
          className="relative flex flex-1 touch-manipulation select-none flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium outline-none before:absolute before:-top-7 before:left-1/2 before:size-16 before:-translate-x-1/2 before:rounded-full"
          aria-label={speech.supported ? t("capture.voice.fab") : t("capture.title")}
          aria-haspopup="dialog"
        >
          <Plus className="h-5 w-5 opacity-0" aria-hidden="true" />
          <span className="invisible">+</span>
        </button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            {...asTrigger(
              <Button>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("dashboard.quickAdd")}
              </Button>
            )}
          />
          <DropdownMenuContent align="center" side="bottom">
            <DropdownMenuItem onClick={() => openDialog("expense")}>
              <TrendingDown className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.expense")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("income")}>
              <TrendingUp className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.income")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog("transfer")}>
              <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("transactions.types.transfer")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {loadedDialogs.expense ? <TransactionForm
        defaultType="expense"
        accounts={variant === "nav-center" ? liveOptions.accounts : accounts}
        categories={variant === "nav-center" ? liveOptions.categories : categories}
        prefill={manualPrefill ?? { amount: carryOverAmount }}
        onSwitchToTransfer={(amount) => requestSwitch("transfer", amount)}
        trigger={null}
        open={activeDialog === "expense"}
        onOpenChange={(open) => setActiveDialog(open ? "expense" : null)}
      /> : null}
      {loadedDialogs.income ? <TransactionForm
        defaultType="income"
        accounts={variant === "nav-center" ? liveOptions.accounts : accounts}
        categories={variant === "nav-center" ? liveOptions.categories : categories}
        prefill={{ amount: carryOverAmount }}
        onSwitchToTransfer={(amount) => requestSwitch("transfer", amount)}
        trigger={null}
        open={activeDialog === "income"}
        onOpenChange={(open) => setActiveDialog(open ? "income" : null)}
      /> : null}
      {loadedDialogs.transfer ? <TransferForm
        accounts={variant === "nav-center" ? liveOptions.accounts : accounts}
        prefillAmount={carryOverAmount}
        onSwitchToTransaction={(type, amount) => requestSwitch(type, amount)}
        trigger={null}
        open={activeDialog === "transfer"}
        onOpenChange={(open) => setActiveDialog(open ? "transfer" : null)}
      /> : null}
      {variant === "nav-center" && captureMounted ? (
        <QuickCaptureSheet
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          accounts={liveOptions.accounts}
          categories={liveOptions.categories}
          onManual={(prefill) => {
            setLoadedDialogs((current) => (current.expense ? current : { ...current, expense: true }));
            setManualPrefill(prefill);
            setCarryOverAmount(undefined);
            setActiveDialog("expense");
          }}
          onIncome={() => openDialog("income")}
          onTransfer={() => openDialog("transfer")}
          initialText={captureInitialText}
        />
      ) : null}
      {variant === "nav-center" && voiceMounted ? (
        <VoiceNotebook
          open={voiceOpen}
          onClose={closeVoice}
          transcript={voiceText}
          listening={speech.listening}
          micError={speech.error}
          onMicStart={() => speech.startHold(voiceText)}
          onMicStop={() => speech.stopHold()}
          accounts={liveOptions.accounts}
          categories={liveOptions.categories}
          onEdit={(text) => {
            closeVoice();
            void loadQuickCaptureSheet();
            openCapture(text.trim() || null);
          }}
        />
      ) : null}
    </>
  );
}
