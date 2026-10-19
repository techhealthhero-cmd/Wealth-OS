# Invoice and tax jar server API

No anonymous access. All actions and loaders authenticate and scope queries
by the session user. Actions return `{ success, id }` or `{ error }`; loaders
return `{ success, ...data }` or `{ error }`. Validate loader errors before rendering
empty states. Money inputs/derived outputs use integer satang. Database amount
fields in returned ledger/receivable rows retain baht; use `amountCents` /
`netReceivableCents` for calculations.

- `actions.ts`: `createInvoice`, `updateInvoice`, `markInvoiceSent` (alias
  `sendInvoice`), `voidInvoice`, `markInvoicePaid`.
- `queries.ts`: `getReceivablesSummary(today)` plus the UI read APIs documented below; calendar date in the user's timezone.
- `number.ts`: pure `suggestNextInvoiceNumber(existingNumbers, gregorianYear)`;
  advisory only, since concurrent creation may claim the same number.
- `../tax-jar/actions.ts`: `upsertTaxJarSettings`, `addTaxJarEntry`,
  `deleteTaxJarEntry`. No ledger update action.
- `../tax-jar/queries.ts`: `getTaxJarSettings`, `getTaxJarSummary(taxYear)`.
- Validation/input types: `@/lib/validation/invoices-tax-jar`.

Invoice inputs use camelCase (`invoiceNumber`, `clientName`, `issueDate`,
`dueDate`, `withholdingRatePct`, `items: [{ description, quantity,
unitPriceCents }]`, optional `receiveAccountId`, `categoryId`, `earnProjectId`,
`notes`, `clientIsCompany`). Quantities support two decimal places, matching
numeric(12,2). Client totals/status/ownership are ignored. Totals are always
calculated by the existing pure financial functions.

`markInvoicePaid` delegates all income writes to migration 0047's atomic,
idempotent RPC. It returns `transactionId` and `setAsideSuggestion` containing
`amountCents`, `ratePct`, `mode`. This is a suggestion even for auto mode: it does
not write a tax jar entry. Call `addTaxJarEntry` with the returned transaction id
as `sourceTransactionId` when the UI chooses to allocate; duplicate source
set-asides return `{ success: true, id, alreadySetAside: true }`. If payment commits
but the suggestion read fails, payment still returns success with
`setAsideSuggestion: null` and `suggestionError`; retrying payment is safe.

## Save consistency limit

Migration 0047 supplies no atomic invoice-and-items save RPC, and migrations are
outside this task. Creation removes the draft header if item insertion fails.
Updates stage new items, compare header `updated_at` and editable status, then
remove old items. Failed writes clean staged items; failed removal attempts to
restore the original header only if its version is unchanged. Cleanup errors
are reported. This is best-effort compensation, **not a database transaction**:
intermediate reads may see both item sets, process interruption can leave partial
state, and concurrent payment can commit during an edit. Do not claim atomic
invoice saves. A future transactional save RPC is required to eliminate these
windows; only mark-paid currently provides atomic financial recording.

Tax jar settings: `ratePct`, `mode`, `accountId`, `expense408RatePct`,
`extraDeductionsCents`. Entry fields: `kind`, `amountCents`, `taxYear` (Gregorian),
`rate`, `sourceTransactionId`, `incomeType`, `entryDate`, `note`.
Ownership of referenced accounts/projects/transactions is additionally enforced
by migration 0047's triggers and RLS. Missing migration errors explicitly name
0047; database failures are never presented as empty/default data.

## Authenticated Invoice UI

Routes under `src/app/(app)/money/invoices/`:

- `/money/invoices` — list A, including drafts in Unpaid and sent-only receivables.
- `/money/invoices/new` — create draft or save and mark sent.
- `/money/invoices/[id]` — invoice paper, text/LINE sharing, payment and cancellation.
- `/money/invoices/[id]/edit` — reuse the form; only draft/sent are editable.
- `/money/invoices/[id]/remind` — sent invoices only; other statuses redirect to detail.

`route-screen.tsx` checks `getPrivacyGate("activity")` before invoice/account reads.
Every page is a thin server wrapper; dynamic `params` and `searchParams` are awaited.
`MoneyChrome` hides the Money title/tabs on these routes; the app's bottom nav is retained.
There is no invoice entitlement in the current billing feature registry.

New read-only APIs in `queries.ts`: `listInvoices(today)`, `getInvoice(id, today, reminderOnly = false)`
(`invoice: null` for an owned row not found), `getInvoiceFormContext(today)`.
Each authenticates and explicitly scopes every read to the session user. History and
accounts paginate in 500-row batches. Errors, including later-page failures, never
become empty success. Pass today in the user's timezone; the route derives it from
`profile.timezone`. UI dates are calendar dates, independent of process timezone.

### Screenshot harness contract

Import components directly from `src/features/invoices/components/`.
They accept serializable data and injected action callbacks; no Supabase or Next
router provider is needed. All four take `copy: Dictionary["invoiceUi"]` (use
`th.invoiceUi` or `en.invoiceUi`) and optional `locale: "th" | "en"` (default `th`).
Next's normal `Link` is used for links. Sample invoice data is in
`tests/fixtures/invoice-ui.ts`; types are in `ui-logic.ts`.

| Component / file | Additional props |
| --- | --- |
| `InvoiceListScreen` / `invoice-list-screen.tsx` | `invoices: InvoiceListEntry[]`, `today: string`, optional `error: string`, `initialTab: "unpaid" \| "overdue" \| "paid"` |
| `InvoiceFormScreen` / `invoice-form-screen.tsx` | `context: InvoiceFormContext`, optional `invoice: InvoiceView` for editing, `onSave(InvoiceInput): Promise<InvoiceActionResult>`, `onMarkSent(id): Promise<InvoiceActionResult>`, optional `onNavigate(href): void` (default full navigation) |
| `InvoiceDetailScreen` / `invoice-detail-screen.tsx` | `invoice: InvoiceView`, `today: string`, `accounts: ReceiveAccount[]`, optional `highlightShare: boolean`, `onMarkSent(id)`, `onVoid(id)` returning `Promise<InvoiceActionResult>`, `onPaid(input)` matching `markInvoicePaid` |
| `InvoiceReminderScreen` / `invoice-reminder-screen.tsx` | `invoice: InvoiceView`, `today: string`, optional `initialTone: "polite" \| "friendly" \| "firm"`, `initialEnding: "ค่ะ" \| "ครับ"` |

`InvoiceListEntry` includes `id`, `invoiceNumber`, `clientName`, `clientIsCompany`,
`issueDate`, `dueDate`, `status`, `displayStatus`, `netReceivableCents`,
`withholdingRatePct`, `paidAt`, `daysOverdue`. `InvoiceView` additionally has
`items: { description, quantity, unitPriceCents }[]`, `receiveAccountId`,
`receiveAccountName`, `notes`, and optional preserved `categoryId`/`earnProjectId`.
`InvoiceFormContext` has `today`, `suggestedNumber`, `clients: ClientSuggestion[]`,
`accounts: { id, name, account_type }[]`, `defaultReceiveAccountId`.

Reminder messages intentionally stay Thai (including in an English UI), with a
remembered Thai ending. Editing a message preserves it across tone/ending changes;
Regenerate explicitly replaces edits. Clipboard failure exposes a selectable
textarea. Sharing a draft marks it sent before handing over its text. If creation
succeeds but marking sent fails, the form locks saved fields and retries only sending;
Save as draft can still open that saved invoice. Payment suggestions are informational.

Approved deviations from the source HTML: only Copy text and LINE on detail;
no public link, PDF, or remind-me-again box; invoice numbers use Buddhist years.
The app shell's existing bottom navigation is retained. Editable form controls,
notes, issue-date input and account/payment dialogs add space beyond the static mockups.

### Invoice QA behavior and verification

Payment confirmation closes immediately and paints a local paid state before awaiting
`markInvoicePaid`; rejected/thrown actions restore the previous invoice and show the
localized error toast. The RPC arguments and tax-jar settings-before-commit guard,
post-commit cash read, suggestion feedback, and cache invalidations remain intact.
The request-scoped context reuses `getAuthUser` and React `cache`, including the
settings loader called by payment. No financial writes or formulas were changed.

Reminder reads pass `reminderOnly = true`: only the authenticated, owned header is
read; returned items are empty and account name is omitted because reminder text
uses neither. Other consumers must use the default full detail read. Detail/edit
read the invoice and form context concurrently; form history/accounts also load in
parallel. Copy toasts use a screen-specific ID, 1200ms duration and route/unmount
cleanup; the detail reminder link dismisses before navigating.

`resolveReceiveAccount` is shared by form, detail/payment and form-context default
selection. It chooses a valid invoice account, then a valid supplied default, then
an only active account. The most recent invoice's valid account remains the form
context's preference; multiple accounts without that preference stay unselected.
There is no profile/account default-account field in this schema.

Date audit: `issue_date`, `due_date` and `paid_at` are SQL dates, mapped verbatim.
Defaults and the list header use `todayInTimeZone(profile.timezone)` (Bangkok fallback);
the header represents today, not an invoice's creation/issue date. Formatting and
+15-day arithmetic already use explicit UTC as a calendar-date carrier, independent
of server TZ. The reported next-day shift could not be reproduced from this branch;
new regressions cover 23:30/00:00 Bangkok, alternate profile zones, date-only rendering
and year rollover. Investigating an already incorrect stored issue date requires an
example of the original issue-date input and stored date; no stored dates were altered.
