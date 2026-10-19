"use client";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatThaiDate, interpolate, type DisplayStatus } from "../ui-logic";
export type InvoiceCopy = Dictionary["invoiceUi"];
export type ScreenCopyProps = { copy: InvoiceCopy; locale?: "th" | "en" };
export const card = "rounded-[18px] border bg-card text-card-foreground shadow-card";
export const field =
  "w-full min-w-0 rounded-[13px] border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary";
export function SelectField({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className={`relative inline-block min-w-0 ${className}`}>
      <select
        {...props}
        className="w-full min-w-0 appearance-none rounded-[13px] border bg-card py-2.5 pr-8 pl-3 text-base text-card-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
      >
        ⌄
      </span>
    </span>
  );
}
export function ThaiDateField({
  value,
  helper,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type" | "value"> & { value: string; helper?: string }) {
  return (
    <span
      className={`relative flex min-w-0 items-center justify-between gap-1 rounded-[13px] border bg-card px-2.5 py-2.5 text-sm text-card-foreground focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${className}`}
    >
      <span aria-hidden="true" className="whitespace-nowrap">
        {value ? formatThaiDate(value) : "—"}
      </span>
      {helper && (
        <span aria-hidden="true" className="shrink-0 text-[11px] text-muted-foreground">
          {helper}
        </span>
      )}
      <input {...props} type="date" value={value} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </span>
  );
}
export const primary =
  "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#204d3d] px-4 py-3 font-semibold text-white shadow-[0_3px_0_#123228] disabled:opacity-50";
export const outline =
  "flex min-h-[48px] w-full items-center justify-center rounded-[15px] border border-primary bg-card px-3 py-2 font-semibold text-primary dark:text-emerald-200 disabled:opacity-50";
export const muted = "text-[12.5px] text-muted-foreground";
export const rose =
  "border-[#e3a898] bg-gradient-to-r from-[#fff1ec] to-card dark:border-rose-900 dark:from-rose-950/40";
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-lg space-y-4 pb-36 text-[15px]">{children}</div>;
}
export function Header({
  title,
  back = "/money/invoices",
  aside,
  copy,
}: {
  title: string;
  back?: string;
  aside?: ReactNode;
  copy: InvoiceCopy;
}) {
  return (
    <header className="flex items-center justify-between gap-2 py-2">
      <Link
        href={back}
        aria-label={copy.back}
        className="grid size-9 shrink-0 place-items-center rounded-xl border bg-card text-2xl"
      >
        ‹
      </Link>
      <h1 className="min-w-0 break-words text-center text-[22px] font-bold">{title}</h1>
      <div className="shrink-0">{aside}</div>
    </header>
  );
}
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#7fd6b2] px-2 py-0.5 text-[11px] font-semibold text-[#0f3d2c]">
      {children}
    </span>
  );
}
export function StatusChip({ status, copy }: { status: DisplayStatus; copy: InvoiceCopy }) {
  const colors =
    status === "overdue"
      ? "bg-[#fbe4dc] text-[#b3402c] dark:bg-rose-950 dark:text-rose-200"
      : status === "sent"
        ? "bg-[#f6e8c1] text-[#8a6a1c]"
        : status === "paid"
          ? "bg-[#dcf3e8] text-[#204d3d]"
          : "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors}`}>
      {copy.statuses[status]}
    </span>
  );
}
export function Notice({ error, message }: { error?: string | null; message?: string | null }) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-secondary p-3 text-sm">
          {message}
        </p>
      )}
    </>
  );
}
export function InvoiceError({ message, copy }: { message: string; copy: InvoiceCopy }) {
  return (
    <Screen>
      <Header title={copy.title} copy={copy} />
      <Notice error={message} />
    </Screen>
  );
}
export async function copyInvoiceText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
export function CopyFallback({ text, copy }: { text: string; copy: InvoiceCopy }) {
  return (
    <label className="block text-sm">
      {copy.copyFallback}
      <textarea
        readOnly
        autoFocus
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        className={`${field} mt-2 min-h-48`}
      />
    </label>
  );
}
export function DueMeta({
  dueDate,
  today,
  copy,
  date,
  days,
}: {
  dueDate: string;
  today: string;
  copy: InvoiceCopy;
  date: string;
  days: number;
}) {
  return (
    <>
      {dueDate === today
        ? copy.dueToday
        : interpolate(dueDate < today ? copy.overdueDays : copy.futureDays, { days: Math.abs(days) })}{" "}
      · {interpolate(copy.dueShort, { date })}
    </>
  );
}
