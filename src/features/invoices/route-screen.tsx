import { notFound, redirect } from "next/navigation";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { todayInTimeZone } from "@/lib/date";
import { invoiceContext } from "./server-context";
import { createInvoice, markInvoicePaid, markInvoiceSent, updateInvoice, voidInvoice } from "./actions";
import { getInvoice, getInvoiceFormContext, listInvoices } from "./queries";
import { InvoiceListScreen } from "./components/invoice-list-screen";
import { InvoiceFormScreen } from "./components/invoice-form-screen";
import { InvoiceDetailScreen } from "./components/invoice-detail-screen";
import { InvoiceReminderScreen } from "./components/invoice-reminder-screen";
import { InvoiceError } from "./components/shared";

/** Every route checks privacy before reading any invoice/account data. */
export async function InvoiceRouteScreen({
  mode,
  id,
  share,
}: {
  mode: "list" | "new" | "detail" | "edit" | "remind";
  id?: string;
  share?: boolean;
}) {
  const privacyGate = await getPrivacyGate("activity");
  if (privacyGate) return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;
  const { dict, locale, timezone } = await invoiceContext();
  const copy = dict.invoiceUi;
  const today = todayInTimeZone(timezone);
  const shared = { copy, locale };
  if (mode === "list") {
    const result = await listInvoices(today);
    return <InvoiceListScreen {...shared} today={today} invoices={result.invoices ?? []} error={result.error} />;
  }
  if (mode === "new") {
    const result = await getInvoiceFormContext(today);
    if (!result.context) return <InvoiceError copy={copy} message={result.error ?? copy.failed} />;
    return (
      <InvoiceFormScreen {...shared} context={result.context} onSave={createInvoice} onMarkSent={markInvoiceSent} />
    );
  }
  if (!id) notFound();
  const [result, form] = await Promise.all([
    getInvoice(id, today, mode === "remind"),
    mode === "remind" ? Promise.resolve(null) : getInvoiceFormContext(today),
  ]);
  if (result.error) return <InvoiceError copy={copy} message={result.error} />;
  const invoice = result.invoice;
  if (!invoice) notFound();
  if (mode === "remind") {
    if (invoice.status !== "sent") redirect(`/money/invoices/${id}`);
    return <InvoiceReminderScreen key={id} {...shared} invoice={invoice} today={today} />;
  }
  if (mode === "edit" && !["draft", "sent"].includes(invoice.status)) redirect(`/money/invoices/${id}`);
  if (!form?.context) return <InvoiceError copy={copy} message={form?.error ?? copy.failed} />;
  if (mode === "edit")
    return (
      <InvoiceFormScreen
        {...shared}
        invoice={invoice}
        context={form.context}
        onSave={updateInvoice.bind(null, id)}
        onMarkSent={markInvoiceSent}
      />
    );
  return (
    <InvoiceDetailScreen
      key={id}
      {...shared}
      invoice={invoice}
      defaultReceiveAccountId={form.context.defaultReceiveAccountId}
      today={today}
      accounts={form.context.accounts}
      highlightShare={share}
      onMarkSent={markInvoiceSent}
      onVoid={voidInvoice}
      onPaid={markInvoicePaid}
    />
  );
}
