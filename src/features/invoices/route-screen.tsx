import { notFound, redirect } from "next/navigation";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { todayInTimeZone } from "@/lib/date";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
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
  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const copy = getDictionary(locale).invoiceUi;
  const today = todayInTimeZone(profile?.timezone ?? "Asia/Bangkok");
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
  const result = await getInvoice(id, today);
  if (result.error) return <InvoiceError copy={copy} message={result.error} />;
  const invoice = result.invoice;
  if (!invoice) notFound();
  if (mode === "remind") {
    if (invoice.status !== "sent") redirect(`/money/invoices/${id}`);
    return <InvoiceReminderScreen {...shared} invoice={invoice} today={today} />;
  }
  if (mode === "edit" && !["draft", "sent"].includes(invoice.status)) redirect(`/money/invoices/${id}`);
  const form = await getInvoiceFormContext(today);
  if (!form.context) return <InvoiceError copy={copy} message={form.error ?? copy.failed} />;
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
      {...shared}
      invoice={invoice}
      today={today}
      accounts={form.context.accounts}
      highlightShare={share}
      onMarkSent={markInvoiceSent}
      onVoid={voidInvoice}
      onPaid={markInvoicePaid}
    />
  );
}
