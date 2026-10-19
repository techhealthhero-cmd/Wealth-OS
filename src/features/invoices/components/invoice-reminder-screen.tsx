"use client";
import { useInvoiceCopyToast } from "./use-invoice-copy-toast";
import { useState, useSyncExternalStore } from "react";
import {
  buildLineShareUrl,
  buildReminderText,
  calendarDaysBetween,
  formatThaiDate,
  interpolate,
  invoiceMoney,
  type InvoiceView,
  type ReminderEnding,
  type ReminderTone,
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
  rose,
  Screen,
  type ScreenCopyProps,
} from "./shared";
const STORAGE_KEY = "wealth-os-invoice-reminder-ending";
function readEnding(): ReminderEnding {
  try {
    return localStorage.getItem(STORAGE_KEY) === "ครับ" ? "ครับ" : "ค่ะ";
  } catch {
    return "ค่ะ";
  }
}
function subscribeEnding(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
export interface InvoiceReminderScreenProps extends ScreenCopyProps {
  invoice: InvoiceView;
  today: string;
  initialTone?: ReminderTone;
  initialEnding?: ReminderEnding;
}
export function InvoiceReminderScreen({
  invoice,
  today,
  initialTone = "polite",
  initialEnding,
  copy,
  locale = "th",
}: InvoiceReminderScreenProps) {
  const copyToast = useInvoiceCopyToast();
  const storedEnding = useSyncExternalStore(subscribeEnding, readEnding, () => "ค่ะ" as const);
  const [endingOverride, setEnding] = useState<ReminderEnding | undefined>(initialEnding);
  const ending = endingOverride ?? storedEnding;
  const [tone, setTone] = useState<ReminderTone>(initialTone);
  const [editedText, setEditedText] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [fallback, setFallback] = useState(false);
  const text = editedText ?? buildReminderText(invoice, { copy, tone, ending, today });
  const days = calendarDaysBetween(invoice.dueDate, today);
  async function copyText() {
    if (await copyInvoiceText(text)) {
      setMessage(copy.copied);
      copyToast.show(copy.copied);
      setFallback(false);
    } else setFallback(true);
  }
  return (
    <Screen>
      <Header
        title={copy.remind}
        copy={copy}
        back={`/money/invoices/${invoice.id}`}
        aside={
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${days > 0 ? "bg-[#fbe4dc] text-[#b3402c]" : "bg-secondary text-muted-foreground"}`}
          >
            {days === 0
              ? copy.dueToday
              : interpolate(days > 0 ? copy.overdueDays : copy.dueIn, { days: Math.abs(days) })}
          </span>
        }
      />
      <section className={`${card} ${rose} p-4`}>
        <h2 className="font-bold">{invoice.clientName}</h2>
        <p className={muted}>
          {invoice.invoiceNumber} ·{" "}
          {interpolate(copy.dueShort, { date: formatThaiDate(invoice.dueDate, false, locale) })}
        </p>
        <p className="mt-1 text-[32px] font-bold text-[#b3402c] tabular-nums dark:text-rose-300">
          {invoiceMoney(invoice.netReceivableCents)}
        </p>
        <p className={muted}>{interpolate(copy.reminderAmount, { rate: invoice.withholdingRatePct })}</p>
      </section>
      <div>
        <label htmlFor="reminder-message" className={`mb-2 block ${muted}`}>
          {interpolate(copy.suggestedMessage, { tone: copy.tones[tone] })}
        </label>
        <textarea
          id="reminder-message"
          value={text}
          onChange={(e) => setEditedText(e.target.value)}
          className="min-h-56 w-full resize-y rounded-[18px_18px_18px_4px] border border-[#bfe3cc] bg-[#e9f7ee] p-4 leading-[1.65] text-[#26332d] outline-none focus:ring-2 focus:ring-primary dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        />
        <div
          role="group"
          aria-label={copy.suggestedMessage.replace("{tone}", "")}
          className="mt-2 flex rounded-full bg-secondary/60 p-1"
        >
          {(["polite", "friendly", "firm"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tone === value}
              className={`min-h-9 flex-1 rounded-full px-2 text-sm ${tone === value ? "bg-card font-semibold text-primary shadow-sm dark:text-emerald-200" : "text-muted-foreground"}`}
              onClick={() => setTone(value)}
            >
              {copy.tones[value]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={copy.ending} className="mt-2 flex items-center justify-end gap-1 text-xs">
          <span className="mr-1 text-muted-foreground">{copy.ending}</span>
          {(["ค่ะ", "ครับ"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={ending === value}
              className={`rounded-full border px-3 py-1 ${ending === value ? "bg-primary text-primary-foreground" : "bg-card"}`}
              onClick={() => {
                setEnding(value);
                try {
                  localStorage.setItem(STORAGE_KEY, value);
                } catch {
                  /* The toggle still works without persistent storage. */
                }
              }}
            >
              {value}
            </button>
          ))}
        </div>
        {editedText !== null && (
          <div className={`mt-2 ${muted}`}>
            <p>{copy.editedHint}</p>
            <button
              className="mt-1 font-semibold text-primary underline dark:text-emerald-200"
              onClick={() => setEditedText(null)}
            >
              {copy.regenerate}
            </button>
          </div>
        )}
      </div>
      <button
        className={`${primary} bg-[#06c755] shadow-[0_3px_0_#04913d]`}
        onClick={() => window.open(buildLineShareUrl(text), "_blank", "noopener,noreferrer")}
      >
        {copy.sendLine}
      </button>
      <button className={outline} onClick={copyText}>
        {copy.copy}
      </button>
      <Notice message={message} />
      {fallback && <CopyFallback text={text} copy={copy} />}
    </Screen>
  );
}
