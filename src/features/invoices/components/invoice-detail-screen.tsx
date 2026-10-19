"use client";
import Link from "next/link";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import { useInvoiceCopyToast } from "./use-invoice-copy-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateInvoiceTotals } from "@/lib/financial/invoice";
import type { InvoiceActionResult, markInvoicePaid } from "../actions";
import {
  buildInvoiceShareText,
  buildLineShareUrl,
  formatThaiDate,
  interpolate,
  invoiceMoney,
  resolveReceiveAccount,
  type InvoiceView,
  type ReceiveAccount,
} from "../ui-logic";
import {
  card,
  CopyFallback,
  copyInvoiceText,
  Header,
  muted,
  Notice,
  outline,
  primary,
  Screen,
  SelectField,
  StatusChip,
  ThaiDateField,
  type ScreenCopyProps,
} from "./shared";
export interface InvoiceDetailScreenProps extends ScreenCopyProps {
  invoice: InvoiceView;
  today: string;
  accounts: ReceiveAccount[];
  highlightShare?: boolean;
  defaultReceiveAccountId?: string | null;
  onMarkSent: (id: string) => Promise<InvoiceActionResult>;
  onVoid: (id: string) => Promise<InvoiceActionResult>;
  onPaid: (input: Parameters<typeof markInvoicePaid>[0]) => ReturnType<typeof markInvoicePaid>;
}
export function InvoiceDetailScreen({
  invoice: initialInvoice,
  today,
  accounts,
  highlightShare,
  defaultReceiveAccountId,
  copy,
  locale = "th",
  onMarkSent,
  onVoid,
  onPaid,
}: InvoiceDetailScreenProps) {
  const copyToast = useInvoiceCopyToast();
  const resolvedAccount = resolveReceiveAccount(accounts, initialInvoice.receiveAccountId, defaultReceiveAccountId);
  const [invoice, setInvoice] = useState({
    ...initialInvoice,
    ...(["draft", "sent"].includes(initialInvoice.status) ? {
      receiveAccountId: resolvedAccount?.id ?? null,
      receiveAccountName: resolvedAccount?.name ?? null,
    } : {}),
  });
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [fallback, setFallback] = useState<string>();
  const [dialog, setDialog] = useState<"paid" | "void" | null>(null);
  const [paidDate, setPaidDate] = useState(today);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.id === invoice.receiveAccountId)?.id ?? "");
  const [pending, startTransition] = useTransition();
  function notify(text: string) {
    setMessage(text);
    toast.success(text);
  }
  const totals = calculateInvoiceTotals(invoice.items, { withholdingRatePct: invoice.withholdingRatePct });
  const editable = invoice.status === "draft" || invoice.status === "sent";
  function share(kind: "copy" | "line") {
    // Reserve a browsing context in the user gesture before awaiting a draft transition.
    const popup = kind === "line" ? window.open("about:blank", "_blank") : null;
    if (popup) popup.opener = null;
    setError(undefined);
    startTransition(async () => {
      try {
        let sent = false;
        if (invoice.status === "draft") {
          const result = await onMarkSent(invoice.id);
          if (result.error || !result.success) {
            popup?.close();
            setError(result.error ?? copy.failed);
            return;
          }
          sent = true;
          setInvoice((current) => ({
            ...current,
            status: "sent",
            displayStatus: current.dueDate < today ? "overdue" : "sent",
          }));
        }
        const text = buildInvoiceShareText(invoice, { copy, locale });
        if (kind === "copy") {
          if (await copyInvoiceText(text)) {
            setFallback(undefined);
            setMessage(copy.copied);
            copyToast.show(sent ? `${copy.copied} · ${copy.sentToast}` : copy.copied);
          } else {
            setFallback(text);
            if (sent) notify(copy.sentToast);
          }
        } else {
          if (popup) popup.location.replace(buildLineShareUrl(text));
          else setFallback(text);
          if (sent) notify(copy.sentToast);
        }
      } catch {
        popup?.close();
        setError(copy.failed);
      }
    });
  }
  function confirm() {
    setError(undefined);
    if (dialog === "paid" && (!paidDate || paidDate > today || !accountId))
      return setError(!accountId ? copy.chooseAccount : copy.invalidInput);
    const paying = dialog === "paid";
    const previous = invoice;
    if (paying) {
      // Urgent updates paint before the action/revalidation round-trip.
      setDialog(null);
      setInvoice({ ...invoice, status: "paid", displayStatus: "paid", paidAt: paidDate });
    }
    function paymentFailed(text: string) {
      setInvoice(previous);
      setError(text);
      toast.error(text);
    }
    startTransition(async () => {
      try {
        if (!paying) {
          const result = await onVoid(invoice.id);
          if (result.error || !result.success) return setError(result.error ?? copy.failed);
          setInvoice((current) => ({ ...current, status: "void", displayStatus: "void" }));
        } else {
          const result = await onPaid({
            invoiceId: invoice.id,
            paidDate,
            accountId,
            allowDraft: invoice.status === "draft",
          });
          if (result.error || !result.success) return paymentFailed(result.error ?? copy.failed);
          notify(
            result.setAsideSuggestion
              ? interpolate(copy.setAside, {
                  amount: invoiceMoney(result.setAsideSuggestion.amountCents),
                  rate: result.setAsideSuggestion.ratePct,
                })
              : result.suggestionError
                ? copy.paymentSuggestionUnavailable
                : copy.paymentDone,
          );
        }
        setDialog(null);
      } catch {
        if (paying) paymentFailed(copy.failed);
        else setError(copy.failed);
      }
    });
  }
  return (
    <Screen>
      <Header
        title={invoice.invoiceNumber}
        copy={copy}
        aside={<StatusChip status={invoice.displayStatus} copy={copy} />}
      />
      <article className={`${card} p-[18px]`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={muted}>{copy.to}</p>
            <h2 className="break-words text-[17px] font-bold">{invoice.clientName}</h2>
            <p className={muted}>{invoice.clientIsCompany ? copy.company : copy.individual}</p>
          </div>
          <div className={`shrink-0 text-right ${muted}`}>
            <p>
              {copy.issued} {formatThaiDate(invoice.issueDate, false, locale)}
            </p>
            <b className="text-foreground">
              {interpolate(copy.dueShort, { date: formatThaiDate(invoice.dueDate, false, locale) })}
            </b>
          </div>
        </div>
        <div className="my-3.5 space-y-2 border-y border-dashed py-3.5">
          {invoice.items.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="min-w-0 break-words">
                {item.description}
                <p className={`${muted} tabular-nums`}>
                  {item.quantity} × {invoiceMoney(item.unitPriceCents)}
                </p>
              </div>
              <span className="shrink-0 tabular-nums">
                {invoiceMoney(calculateInvoiceTotals([item]).subtotalCents)}
              </span>
            </div>
          ))}
        </div>
        <div className={`flex justify-between ${muted}`}>
          <span>{copy.total}</span>
          <span>{invoiceMoney(totals.subtotalCents)}</span>
        </div>
        <div className={`flex justify-between gap-2 ${muted}`}>
          <span>
            {copy.withholding} {invoice.withholdingRatePct}% ({copy.taxCredit})
          </span>
          <span>−{invoiceMoney(totals.withholdingCents)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <b>{copy.net}</b>
          <b className="text-[28px] text-primary tabular-nums dark:text-emerald-200">
            {invoiceMoney(totals.netReceivableCents)}
          </b>
        </div>
        {(invoice.notes || invoice.receiveAccountName) && (
          <div className={`mt-3 rounded-xl bg-secondary p-2.5 ${muted}`}>
            {invoice.notes && (
              <p>
                {copy.notes}: {invoice.notes}
              </p>
            )}
            {invoice.receiveAccountName && (
              <p>
                {copy.receive}: {invoice.receiveAccountName}
              </p>
            )}
          </div>
        )}
      </article>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {invoice.status === "paid" && (
        <p className="rounded-xl bg-emerald-100 p-3 text-center font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {interpolate(copy.paidOn, { date: formatThaiDate(invoice.paidAt!, false, locale) })}
        </p>
      )}
      {invoice.status !== "void" && (
        <section
          className={`space-y-2 rounded-2xl ${highlightShare ? "ring-2 ring-[#c9a24a] ring-offset-4 ring-offset-background" : ""}`}
        >
          <h2 className={muted}>{copy.sendToClient}</h2>
          {highlightShare && <p className={muted}>{copy.shareHint}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={pending}
              className={`${card} min-h-20 px-2 py-3 text-center text-[13px] font-semibold disabled:opacity-50`}
              onClick={() => share("copy")}
            >
              <span className="mb-1 block text-2xl" aria-hidden>
                ▤
              </span>
              {copy.copy}
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${card} min-h-20 border-[#06c755] px-2 py-3 text-center text-[13px] font-semibold text-[#04913d] dark:text-emerald-300 disabled:opacity-50`}
              onClick={() => share("line")}
            >
              <span className="mb-1 block text-2xl" aria-hidden>
                💬
              </span>
              LINE
            </button>
          </div>
        </section>
      )}
      {fallback && <CopyFallback text={fallback} copy={copy} />}
      {invoice.status === "sent" && (
        <Link
          href={`/money/invoices/${invoice.id}/remind`}
          onNavigate={copyToast.dismiss}
          className={
            invoice.displayStatus === "overdue"
              ? `${outline} border-[#b3402c] text-[#b3402c] dark:text-rose-300`
              : outline
          }
        >
          {copy.remind} ›
        </Link>
      )}
      {editable && (
        <>
          <button
            className={primary}
            disabled={pending}
            onClick={() => {
              setError(undefined);
              setDialog("paid");
            }}
          >
            {copy.received}
          </button>
          <div className={`text-center leading-6 ${muted}`}>
            <p>
              {interpolate(copy.paymentCaption, {
                amount: invoiceMoney(invoice.netReceivableCents),
                account: invoice.receiveAccountName ?? copy.chooseAccount,
              })}
            </p>
            <Link href={`/money/invoices/${invoice.id}/edit`} className="underline">
              {copy.edit}
            </Link>{" "}
            ·{" "}
            <button
              disabled={pending}
              className="underline"
              onClick={() => {
                setError(undefined);
                setDialog("void");
              }}
            >
              {copy.voidAction}
            </button>
          </div>
        </>
      )}
      {!dialog && <Notice error={error} />}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <DialogContent
          overlayClassName="z-[60] bg-black/40"
          className="top-auto bottom-0 z-[61] max-w-full translate-y-0 rounded-t-2xl rounded-b-none bg-card pb-[calc(1rem+env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-sm sm:-translate-y-1/2 sm:rounded-2xl sm:pb-4"
        >
          <DialogHeader>
            <DialogTitle>{dialog === "paid" ? copy.confirmPaid : copy.confirmVoid}</DialogTitle>
          </DialogHeader>
          {dialog === "paid" && (
            <>
              <label className="space-y-1 text-sm">
                {copy.paidDate}
                <ThaiDateField
                  aria-label={copy.paidDate}
                  max={today}
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                {copy.receive}
                <SelectField value={accountId} className="w-full" onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">{copy.chooseAccount}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </SelectField>
              </label>
            </>
          )}
          <Notice error={error} />
          <button disabled={pending} className={primary} onClick={confirm}>
            {pending ? copy.saving : copy.confirm}
          </button>
          <button disabled={pending} className={outline} onClick={() => setDialog(null)}>
            {copy.cancel}
          </button>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
