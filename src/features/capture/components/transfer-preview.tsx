"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";

import type { Account } from "@/types/database";
import type { AccountSlot, TransferIntent } from "@/lib/capture/transfer";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { formatFriendlyDate } from "@/lib/transaction-ui";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { AccountPicker } from "@/features/transactions/components/account-picker";

type Side = "from" | "to";

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  try {
    const cents = parseMoneyToCents(cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

/**
 * Transfer confirmation for typed Quick Capture. It consumes the exact same
 * `TransferIntent` as the voice notebook; this component only presents the
 * unresolved choices and never tries to interpret the sentence again.
 */
export function TransferPreview({
  intent,
  accounts,
  amountCents,
  date,
  fromId,
  toId,
  saving,
  onAmountChange,
  onPick,
  onSave,
}: {
  intent: TransferIntent;
  accounts: Account[];
  amountCents: number | null;
  date: string;
  fromId: string | null;
  toId: string | null;
  saving: boolean;
  onAmountChange: (amountCents: number | null) => void;
  onPick: (side: Side, accountId: string, rememberWord: string | null) => void;
  onSave: () => void;
}) {
  const { t, locale } = useTranslation();
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const [remember, setRemember] = useState(true);
  const [amountText, setAmountText] = useState(() => (amountCents === null ? "" : (amountCents / 100).toString()));
  const [lastAmount, setLastAmount] = useState(amountCents);

  if (amountCents !== lastAmount) {
    setLastAmount(amountCents);
    setAmountText(amountCents === null ? "" : (amountCents / 100).toString());
  }

  const active = accounts.filter((account) => !account.is_archived);
  const ready = Boolean(amountCents && fromId && toId && fromId !== toId);
  const name = (id: string | null) => active.find((account) => account.id === id)?.name ?? t("capture.voice.pickAccount");

  const renderSide = (side: Side, slot: AccountSlot, selectedId: string | null, otherId: string | null) => {
    const label = side === "from" ? t("transactions.fromAccount") : t("transactions.toAccount");
    const heard = slot.status === "matched" ? slot.heard : slot.heard;
    const candidates = slot.status === "ambiguous" ? slot.candidates.filter((id) => id !== otherId) : [];
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <button
          type="button"
          aria-expanded={openSide === side}
          onClick={() => {
            setRemember(true);
            setOpenSide(openSide === side ? null : side);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate">{name(selectedId)}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        {slot.status === "matched" && slot.heard ? (
          <p className="text-xs text-muted-foreground">{t("capture.voice.heardAs").replace("{heard}", slot.heard).replace("{name}", name(slot.accountId))}</p>
        ) : slot.status === "ambiguous" && !selectedId ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t("capture.voice.whichAccount").replace("{heard}", slot.heard)}</p>
        ) : slot.status === "unknown" && slot.heard && !selectedId ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t("capture.voice.unknownAccount").replace("{heard}", slot.heard)}</p>
        ) : null}
        {slot.status === "ambiguous" && !selectedId ? (
          <div className="flex flex-wrap gap-2">
            {candidates.map((id) => (
              <Button key={id} type="button" size="sm" variant="outline" onClick={() => onPick(side, id, null)}>
                {name(id)}
              </Button>
            ))}
          </div>
        ) : null}
        {openSide === side ? (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <AccountPicker
              name={`__capture_transfer_${side}`}
              accounts={active.filter((account) => account.id !== otherId)}
              value={selectedId ?? undefined}
              onValueChange={(id) => {
                onPick(side, id, remember && heard ? heard : null);
                setOpenSide(null);
              }}
            />
            {heard ? (
              <label className="flex min-h-11 items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
                <span>
                  {t("capture.voice.pickerRemember").replace("{heard}", heard)}
                  <span className="mt-0.5 block">{t("capture.voice.pickerRememberHint")}</span>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-card animate-in fade-in slide-in-from-bottom-1 duration-(--motion-normal)">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("capture.preview")}</p>
        <p className="text-sm font-semibold text-sky-700 dark:text-sky-400">{t("capture.voice.transfer")}</p>
      </div>
      <div>
        <label htmlFor="capture-transfer-amount" className="sr-only">{t("capture.amount")}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">฿</span>
          <input
            id="capture-transfer-amount"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => {
              setAmountText(event.target.value);
              const cents = parseAmount(event.target.value);
              setLastAmount(cents);
              onAmountChange(cents);
            }}
            placeholder="0"
            className="w-full min-w-0 bg-transparent text-4xl font-bold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        {amountCents === null ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("capture.amountMissing")}</p> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        {renderSide("from", intent.from, fromId, toId)}
        <ArrowRight className="mt-8 size-5 text-muted-foreground" aria-hidden="true" />
        {renderSide("to", intent.to, toId, fromId)}
      </div>
      <p className="text-xs text-muted-foreground">📅 {formatFriendlyDate(date, locale, { today: t("capture.today"), yesterday: t("capture.yesterday") })}</p>
      <Button type="button" className="h-12 w-full rounded-2xl text-base" onClick={onSave} disabled={saving || !ready}>
        <Check className="mr-1.5 size-5" aria-hidden="true" />
        {saving ? t("common.saving") : t("capture.voice.saveOne")}
        {amountCents ? <span className="ml-1 opacity-80">{formatMoney(amountCents)}</span> : null}
      </Button>
    </section>
  );
}
