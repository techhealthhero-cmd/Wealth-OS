"use client";
import Link from "next/link";
import { useState } from "react";
import { summarizeReceivables } from "@/lib/financial/invoice";
import {
  calendarDaysBetween,
  filterByTab,
  formatThaiDate,
  interpolate,
  invoiceMoney,
  invoiceTabCounts,
  shortThaiDate,
  type InvoiceListEntry,
  type InvoiceTab,
} from "../ui-logic";
import { card, DueMeta, muted, Notice, rose, Screen, StatusChip, type ScreenCopyProps } from "./shared";
export interface InvoiceListScreenProps extends ScreenCopyProps {
  invoices: InvoiceListEntry[];
  today: string;
  error?: string;
  initialTab?: InvoiceTab;
}
export function InvoiceListScreen({
  invoices,
  today,
  error,
  initialTab = "unpaid",
  copy,
  locale = "th",
}: InvoiceListScreenProps) {
  const [tab, setTab] = useState<InvoiceTab>(initialTab);
  const totals = summarizeReceivables(invoices, today);
  const counts = invoiceTabCounts(invoices);
  return (
    <Screen>
      <header className="flex items-center justify-between gap-2 py-2">
        <h1 className="text-[26px] font-bold">{copy.title}</h1>
        <time className="text-sm text-muted-foreground">{formatThaiDate(today, false, locale)}</time>
      </header>
      {error ? (
        <Notice error={error} />
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[20px] bg-[#1f4a3d] p-5 text-white shadow-card">
            <div aria-hidden className="absolute -right-10 -top-10 size-36 rounded-full bg-[#7fd6b2]/15" />
            <p className="relative text-white/80">{copy.outstanding}</p>
            <p className="relative my-1 text-[38px] font-bold tabular-nums tracking-tight">
              {invoiceMoney(totals.outstandingCents)}
            </p>
            <p className="relative text-[13px] text-white/80">
              {interpolate(copy.summary, { count: totals.outstandingCount })}
            </p>
            {totals.overdueCount > 0 && (
              <div className="relative mt-4 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2.5 text-sm">
                <span>{interpolate(copy.overdueSummary, { count: totals.overdueCount })}</span>
                <b className="text-[#ffd2c2]">{invoiceMoney(totals.overdueCents)}</b>
              </div>
            )}
          </section>
          <div role="tablist" aria-label={copy.title} className="flex gap-2">
            {(["unpaid", "overdue", "paid"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-10 flex-1 rounded-full border px-2 py-2 text-[13px] font-semibold ${tab === key ? "border-[#204d3d] bg-[#204d3d] text-white" : "bg-card text-muted-foreground"}`}
              >
                {copy.tabs[key]} {counts[key]}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="space-y-3">
            {filterByTab(invoices, tab).map((invoice) => (
              <Link
                href={`/money/invoices/${invoice.id}`}
                key={invoice.id}
                className={`${card} card-interactive block p-4 ${invoice.displayStatus === "overdue" ? rose : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">{invoice.clientName}</h2>
                    <p className={muted}>
                      {invoice.invoiceNumber} · {invoice.clientIsCompany ? copy.company : copy.individual}
                    </p>
                  </div>
                  <b
                    className={`shrink-0 text-lg tabular-nums ${invoice.displayStatus === "overdue" ? "text-[#b3402c] dark:text-rose-300" : ""}`}
                  >
                    {invoiceMoney(invoice.netReceivableCents)}
                  </b>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <StatusChip status={invoice.displayStatus} copy={copy} />
                  <span
                    className={`${muted} ${invoice.displayStatus === "overdue" ? "font-semibold text-[#b3402c] dark:text-rose-300" : ""}`}
                  >
                    {invoice.status === "paid" && invoice.paidAt ? (
                      interpolate(copy.paidOn, { date: shortThaiDate(invoice.paidAt, locale) })
                    ) : invoice.status === "draft" ? (
                      interpolate(copy.dueShort, { date: shortThaiDate(invoice.dueDate, locale) })
                    ) : (
                      <DueMeta
                        dueDate={invoice.dueDate}
                        today={today}
                        copy={copy}
                        date={shortThaiDate(invoice.dueDate, locale)}
                        days={calendarDaysBetween(today, invoice.dueDate)}
                      />
                    )}
                  </span>
                </div>
              </Link>
            ))}
            {counts[tab] === 0 && (
              <div className={`${card} space-y-3 p-6 text-center`}>
                <p className="text-3xl" aria-hidden>
                  ✉
                </p>
                <h2 className="font-semibold">{invoices.length === 0 ? copy.emptyFirst : copy.emptyTabs[tab]}</h2>
                {invoices.length === 0 && (
                  <>
                    <p className={muted}>{copy.emptyHint}</p>
                    <Link
                      className="inline-block font-semibold text-primary dark:text-emerald-200"
                      href="/money/invoices/new"
                    >
                      {copy.create}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg justify-end px-5">
        <Link
          href="/money/invoices/new"
          className="pointer-events-auto rounded-full bg-[#c9a24a] px-5 py-3.5 font-bold text-[#2b2208] shadow-lg"
        >
          {copy.create}
        </Link>
      </div>
    </Screen>
  );
}
