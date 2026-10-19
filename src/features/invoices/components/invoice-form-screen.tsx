"use client";
import { useState, useTransition } from "react";
import type { InvoiceActionResult } from "../actions";
import { calculateInvoiceTotals, type WithholdingRatePct } from "@/lib/financial/invoice";
import { invoiceSchema, type InvoiceInput } from "@/lib/validation/invoices-tax-jar";
import { parseMoneyToCents } from "@/lib/financial/money";
import {
  calendarDaysBetween,
  defaultDueDate,
  resolveReceiveAccount,
  filterClientSuggestions,
  interpolate,
  invoiceMoney,
  suggestWithholdingRate,
  type ClientSuggestion,
  type InvoiceFormContext,
  type InvoiceView,
} from "../ui-logic";
import {
  card,
  Chip,
  ThaiDateField,
  field,
  Header,
  muted,
  Notice,
  primary,
  Screen,
  SelectField,
  StatusChip,
  type ScreenCopyProps,
} from "./shared";
export interface InvoiceFormScreenProps extends ScreenCopyProps {
  context: InvoiceFormContext;
  invoice?: InvoiceView;
  onSave: (input: InvoiceInput) => Promise<InvoiceActionResult>;
  onMarkSent: (id: string) => Promise<InvoiceActionResult>;
  onNavigate?: (href: string) => void;
}
export function InvoiceFormScreen({
  context,
  invoice,
  copy,
  onSave,
  onMarkSent,
  onNavigate = (href) => window.location.assign(href),
}: InvoiceFormScreenProps) {
  const [name, setName] = useState(invoice?.clientName ?? "");
  const [company, setCompany] = useState(invoice?.clientIsCompany ?? false);
  const [selected, setSelected] = useState<ClientSuggestion | undefined>(() =>
    context.clients.find((c) => c.clientName === invoice?.clientName),
  );
  const [dropdown, setDropdown] = useState(false);
  const [rate, setRate] = useState<WithholdingRatePct>(invoice?.withholdingRatePct ?? 0);
  const [issue, setIssue] = useState(invoice?.issueDate ?? context.today);
  const [due, setDue] = useState(invoice?.dueDate ?? defaultDueDate(context.today));
  const [dueAutomatic, setDueAutomatic] = useState(!invoice);
  const [number, setNumber] = useState(invoice?.invoiceNumber ?? context.suggestedNumber);
  const [editNumber, setEditNumber] = useState(false);
  const [account, setAccount] = useState(
    resolveReceiveAccount(context.accounts, invoice?.receiveAccountId, context.defaultReceiveAccountId)?.id ?? "",
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [items, setItems] = useState(() =>
    (invoice?.items ?? [{ description: "", quantity: 1, unitPriceCents: 0 }]).map((item, index) => ({
      key: index,
      description: item.description,
      quantity: String(item.quantity),
      price: invoice ? (item.unitPriceCents / 100).toFixed(2) : "",
    })),
  );
  const [nextKey, setNextKey] = useState(items.length);
  const [error, setError] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const suggestion = suggestWithholdingRate({
    clientIsCompany: company,
    previousRatePct: selected?.withholdingRatePct,
  });
  const parsedItems = items.map((item) => {
    let cents = 0;
    try {
      cents = parseMoneyToCents(item.price || "0");
    } catch {
      cents = NaN;
    }
    return {
      description: item.description,
      quantity: /^\d+(?:\.\d{1,2})?$/.test(item.quantity.trim()) ? Number(item.quantity) : NaN,
      unitPriceCents: cents,
    };
  });
  let totals = { subtotalCents: 0, withholdingCents: 0, netReceivableCents: 0 };
  try {
    totals = calculateInvoiceTotals(parsedItems, { withholdingRatePct: rate });
  } catch {
    /* Invalid numeric input is reported on submit. */
  }
  function pick(client: ClientSuggestion) {
    setSelected(client);
    setName(client.clientName);
    setCompany(client.clientIsCompany);
    setRate(
      suggestWithholdingRate({ clientIsCompany: client.clientIsCompany, previousRatePct: client.withholdingRatePct })
        .ratePct,
    );
    setDropdown(false);
  }
  function submit(send: boolean) {
    setError(undefined);
    const input: InvoiceInput = {
      invoiceNumber: number,
      clientName: name,
      clientIsCompany: company,
      issueDate: issue,
      dueDate: due,
      withholdingRatePct: rate,
      items: parsedItems,
      receiveAccountId: account || null,
      notes,
      categoryId: invoice?.categoryId,
      earnProjectId: invoice?.earnProjectId,
    };
    if (!name.trim()) return setError(copy.clientRequired);
    if (
      !parsedItems.length ||
      parsedItems.some(
        (i) =>
          !i.description.trim() ||
          !Number.isFinite(i.quantity) ||
          i.quantity <= 0 ||
          !Number.isSafeInteger(i.unitPriceCents) ||
          i.unitPriceCents <= 0,
      )
    )
      return setError(copy.itemsRequired);
    if (due < issue) return setError(copy.dueInvalid);
    if (!invoiceSchema.safeParse(input).success) return setError(copy.invalidInput);
    startTransition(async () => {
      try {
        // If save succeeded but sending failed, retry only the status transition.
        const result = savedId ? { success: true, id: savedId } : await onSave(input);
        if (result.error || !result.id) return setError(result.error ?? copy.failed);
        setSavedId(result.id);
        if (send && invoice?.status !== "sent") {
          const sent = await onMarkSent(result.id);
          if (sent.error || !sent.success) return setError(sent.error ?? copy.failed);
        }
        onNavigate(`/money/invoices/${result.id}${send ? "?share=1" : ""}`);
      } catch {
        setError(copy.failed);
      }
    });
  }
  const matches = filterClientSuggestions(context.clients, name);
  const updateItem = (key: number, patch: Partial<(typeof items)[number]>) =>
    setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  let dueDays = 0;
  try {
    dueDays = calendarDaysBetween(issue, due);
  } catch {
    /* Native date input can be cleared. */
  }
  return (
    <Screen>
      <Header
        title={invoice ? copy.editTitle : copy.newTitle}
        copy={copy}
        back={invoice ? `/money/invoices/${invoice.id}` : undefined}
        aside={<StatusChip status={invoice?.displayStatus ?? "draft"} copy={copy} />}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(!invoice);
        }}
        className="space-y-4"
      >
        <fieldset disabled={pending || !!savedId} className="min-w-0 space-y-4 disabled:opacity-70">
          <div className="relative">
            <label htmlFor="invoice-client" className={`mb-1 block ${muted}`}>
              {copy.client}
            </label>
            <input
              id="invoice-client"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={dropdown}
              aria-controls="invoice-clients"
              autoComplete="off"
              value={name}
              maxLength={120}
              className={field}
              onFocus={() => setDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setDropdown(false);
              }}
              onChange={(e) => {
                setName(e.target.value);
                setSelected(undefined);
                setDropdown(true);
                setRate(suggestWithholdingRate({ clientIsCompany: company }).ratePct);
              }}
            />
            {dropdown && (
              <div id="invoice-clients" role="listbox" className={`${card} mt-1 max-h-56 overflow-y-auto py-1`}>
                {matches.map((client) => (
                  <button
                    key={client.clientName}
                    type="button"
                    role="option"
                    aria-selected={client.clientName === selected?.clientName}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-secondary"
                    onClick={() => pick(client)}
                  >
                    <span>
                      <b>{client.clientName}</b>
                      <span className={muted}>
                        {" "}
                        · {client.clientIsCompany ? copy.company : copy.individual} ·{" "}
                        {interpolate(copy.previousAmount, { amount: invoiceMoney(client.subtotalCents) })}
                      </span>
                    </span>
                    <Chip>{copy.fromHistory}</Chip>
                  </button>
                ))}
                {name.trim() && (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className={`w-full border-t px-3 py-3 text-left ${muted}`}
                    onClick={() => {
                      setSelected(undefined);
                      setDropdown(false);
                      setRate(suggestWithholdingRate({ clientIsCompany: company }).ratePct);
                    }}
                  >
                    {interpolate(copy.newClient, { name: name.trim() })}
                  </button>
                )}
              </div>
            )}
            {selected ? (
              <p className={`mt-1 ${muted}`}>
                {interpolate(company ? copy.selectedCompany : copy.selectedIndividual, { rate: suggestion.ratePct })}
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                {[false, true].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={company === value}
                    className={`rounded-full border px-4 py-1 text-sm ${company === value ? "bg-primary text-primary-foreground" : "bg-card"}`}
                    onClick={() => {
                      setCompany(value);
                      setRate(suggestWithholdingRate({ clientIsCompany: value }).ratePct);
                    }}
                  >
                    {value ? copy.company : copy.individual}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className={`mb-1 ${muted}`}>{copy.items}</p>
            <div className={`${card} px-3.5`}>
              {items.map((item, index) => (
                <div key={item.key} className="border-b border-dashed py-3">
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`${copy.description} ${index + 1}`}
                      className="min-w-0 flex-1 bg-transparent py-1 outline-none focus:ring-1 focus:ring-primary"
                      placeholder={copy.placeholder}
                      maxLength={200}
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={`${copy.remove} ${index + 1}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground"
                      onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      aria-label={`${copy.quantity} ${index + 1}`}
                      className="w-12 rounded-md bg-transparent px-1 py-1 text-base text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                      type="text"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                    />
                    <span className={muted}>×</span>
                    <input
                      aria-label={`${copy.unitPrice} ${index + 1}`}
                      className="w-24 min-w-0 rounded-md bg-transparent px-1 py-1 text-base text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                      placeholder={copy.unitPrice}
                      type="text"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) => updateItem(item.key, { price: e.target.value })}
                    />
                    <b className="ml-auto text-sm tabular-nums">
                      {(() => {
                        try {
                          return invoiceMoney(calculateInvoiceTotals([parsedItems[index]]).subtotalCents);
                        } catch {
                          return "—";
                        }
                      })()}
                    </b>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={items.length >= 50}
                className="py-3 font-semibold text-primary dark:text-emerald-200"
                onClick={() => {
                  setItems((rows) => [...rows, { key: nextKey, description: "", quantity: "1", price: "" }]);
                  setNextKey((key) => key + 1);
                }}
              >
                {copy.addItem}
              </button>
              <span className={`ml-2 ${muted}`}>· {copy.placeholder}</span>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2.5">
            <div>
              <label htmlFor="invoice-due" className={`mb-1 block ${muted}`}>
                {copy.due} {dueAutomatic && <Chip>{copy.automatic}</Chip>}
              </label>
              <ThaiDateField
                id="invoice-due"
                value={due}
                min={issue}
                helper={interpolate(copy.dayCount, { days: dueDays })}
                onChange={(e) => {
                  setDue(e.target.value);
                  setDueAutomatic(false);
                }}
              />
            </div>
            <div>
              <label htmlFor="invoice-wht" className={`mb-1 block ${muted}`}>
                {copy.withholding} {rate === suggestion.ratePct && <Chip>{copy.recommended}</Chip>}
              </label>
              <SelectField
                id="invoice-wht"
                value={rate}
                className="w-full"
                onChange={(e) => setRate(Number(e.target.value) as WithholdingRatePct)}
              >
                {[0, 1, 2, 3, 5].map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </SelectField>
              <p className={`mt-1 ${muted}`}>
                {
                  copy[
                    suggestion.reason === "previous"
                      ? "previous"
                      : suggestion.reason === "company"
                        ? "companyHint"
                        : "individualHint"
                  ]
                }
              </p>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <div className={`flex justify-between ${muted}`}>
              <span>{copy.subtotal}</span>
              <span>{invoiceMoney(totals.subtotalCents)}</span>
            </div>
            <div className={`flex justify-between ${muted}`}>
              <span>
                {copy.withholding} {rate}%
              </span>
              <span>−{invoiceMoney(totals.withholdingCents)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
              <b>{copy.net}</b>
              <b className="text-[24px] text-primary tabular-nums dark:text-emerald-200">
                {invoiceMoney(totals.netReceivableCents)}
              </b>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            {editNumber ? (
              <label className="w-full">
                {copy.number}
                <input
                  aria-label={copy.number}
                  value={number}
                  maxLength={40}
                  className={field}
                  onChange={(e) => setNumber(e.target.value)}
                />
              </label>
            ) : (
              <button type="button" onClick={() => setEditNumber(true)}>
                {copy.number} {number} ✎
              </button>
            )}
            <label className="min-w-0 max-w-full">
              {copy.receive}:{" "}
              <SelectField
                aria-label={copy.receive}
                className="max-w-48 align-middle"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">{copy.noAccount}</option>
                {context.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          <label className={`flex items-center justify-between gap-2 ${muted}`}>
            {copy.issue}
            <ThaiDateField
              aria-label={copy.issue}
              value={issue}
              onChange={(e) => {
                const value = e.target.value;
                if (value && dueAutomatic) setDue(defaultDueDate(value));
                setIssue(value);
              }}
            />
          </label>
          <details open={notes ? true : undefined}>
            <summary className={`cursor-pointer ${muted}`}>{copy.addNotes}</summary>
            <textarea
              aria-label={copy.notes}
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              className={`${field} mt-2`}
            />
          </details>
        </fieldset>
        <Notice error={error} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? copy.saving : invoice ? copy.saveEdit : copy.saveSend}
        </button>
        {!invoice && (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(false)}
            className="block w-full py-1 text-center text-sm text-muted-foreground underline"
          >
            {copy.saveDraft}
          </button>
        )}
      </form>
    </Screen>
  );
}
