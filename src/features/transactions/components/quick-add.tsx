"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
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
import {
  QUICK_ADD_REQUEST_EVENT,
  isQuickAddRequestTarget,
  type QuickAddRequestTarget,
} from "@/features/transactions/lib/quick-add-request";

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
  // Once the user types on the paper, a late transcript from the mic they
  // just stopped must not overwrite their correction.
  const typedRef = useRef(false);
  const speech = useSpeechInput(locale, (text) => {
    if (voiceActiveRef.current && !typedRef.current) setVoiceText(text);
  });
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [captureInitialImage, setCaptureInitialImage] = useState<File | null>(null);
  const consumeCaptureInitialImage = useCallback(() => setCaptureInitialImage(null), []);
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
    typedRef.current = false;
    setVoiceText("");
    // Opens the notebook with the mic OFF (2026-10-14, user request): the
    // first tap only opens the page; the notebook's own big mic starts
    // listening (a tap there is the user gesture iOS needs).
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
      // Warm the path this browser will actually open first. Giving idle
      // work a timeout matters on busy mobile launches: without one,
      // Chromium can postpone requestIdleCallback until the first tap,
      // turning that tap into a visible 1s+ module-loading pause.
      if (speech.supported) {
        void loadVoiceNotebook().then(() => loadQuickCaptureSheet());
      } else {
        void loadQuickCaptureSheet();
      }
    };
    const idleId = window.requestIdleCallback?.(warm, { timeout: 800 });
    const fallbackId = idleId === undefined ? window.setTimeout(warm, 600) : undefined;
    return () => {
      window.clearTimeout(timer);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
    };
    // Initial background warm-up only; every actual open refreshes again.
  }, [variant, speech.supported]);

  // A fresh, direct open (FAB / dropdown item / tile) must never inherit an
  // amount left over from an earlier, unrelated switch.
  function openDialog(dialog: Exclude<QuickAddDialog, null>) {
    setLoadedDialogs((current) => (current[dialog] ? current : { ...current, [dialog]: true }));
    setCarryOverAmount(undefined);
    setManualPrefill(null);
    setActiveDialog(dialog);
  }

  // Requests from other pages (Home's quick actions, quick-add-request.ts).
  // Only the shell's single nav-center instance listens, so one request
  // never opens two copies of a form.
  //
  // "income" waits for fresh accounts/categories (and the form chunk)
  // before opening: TransactionForm captures its options once, when it
  // opens, so opening first could leave it with no accounts and a disabled
  // save. This matches the mic → Quick Capture → income path, where the
  // options were already refreshed when the sheet opened. If the refresh
  // fails, the last known options are used when there are any; otherwise
  // the user sees an error instead of a dead form.
  const incomeRequestPendingRef = useRef(false);
  const liveOptionsRef = useRef(liveOptions);
  useEffect(() => {
    liveOptionsRef.current = liveOptions;
  }, [liveOptions]);
  async function openIncomeFromRequest() {
    if (incomeRequestPendingRef.current) return;
    incomeRequestPendingRef.current = true;
    try {
      const [, options] = await Promise.all([loadTransactionForm(), getQuickAddOptions().catch(() => null)]);
      if (options) {
        setLiveOptions(options);
      } else if (liveOptionsRef.current.accounts.length === 0) {
        toast.error(t("common.somethingWentWrong"));
        return;
      }
      openDialog("income");
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      incomeRequestPendingRef.current = false;
    }
  }
  const openFromRequestRef = useRef<(target: QuickAddRequestTarget) => void>(() => {});
  useEffect(() => {
    openFromRequestRef.current = (target) => {
      if (target === "scan") {
        // Stay in the Home tap’s synchronous call stack for iOS Safari.
        scanInputRef.current?.click();
        void loadQuickCaptureSheet();
      } else if (target === "capture") {
        void loadQuickCaptureSheet();
        openCapture();
      } else {
        void openIncomeFromRequest();
      }
    };
  });
  useEffect(() => {
    if (variant !== "nav-center") return;
    const onRequest = (event: Event) => {
      const target = (event as CustomEvent<unknown>).detail;
      if (!isQuickAddRequestTarget(target)) return;
      event.preventDefault(); // tells requestQuickAdd() it was handled
      openFromRequestRef.current(target);
    };
    window.addEventListener(QUICK_ADD_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(QUICK_ADD_REQUEST_EVENT, onRequest);
  }, [variant]);

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
      {variant === "nav-center" ? (
        <input
          ref={scanInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setCaptureInitialImage(file);
            openCapture();
          }}
        />
      ) : null}
      {variant === "row" ? (
        // 2026-10-11: one short row of pills (was three tall tiles) so the
        // pending-review box below stays in the first screen.
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
                "card-interactive flex h-11 items-center justify-center gap-2 rounded-full bg-card px-2 text-card-foreground shadow-card ring-1 ring-foreground/5",
                "transition-colors hover:bg-accent/50"
              )}
            >
              <IconChip icon={item.icon} tone={item.tone} className="size-7 shrink-0 rounded-full" />
              <span className="truncate text-sm font-medium">{item.label}</span>
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
            // notebook, mic off until tapped there. Where the browser has no speech
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
          initialImageFile={captureInitialImage}
          onInitialImageConsumed={consumeCaptureInitialImage}
        />
      ) : null}
      {variant === "nav-center" && voiceMounted ? (
        <VoiceNotebook
          open={voiceOpen}
          onClose={closeVoice}
          transcript={voiceText}
          onTranscriptChange={(text) => {
            typedRef.current = true;
            setVoiceText(text);
          }}
          listening={speech.listening}
          micError={speech.error}
          onMicStart={() => {
            // Speaking again appends to the page as it now reads.
            typedRef.current = false;
            speech.startHold(voiceText);
          }}
          onMicStop={() => speech.stopHold()}
          accounts={liveOptions.accounts}
          categories={liveOptions.categories}
          onMore={(text) => {
            closeVoice();
            void loadQuickCaptureSheet();
            openCapture(text.trim() || null);
          }}
        />
      ) : null}
    </>
  );
}
