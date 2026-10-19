# Invoice and tax jar server API

No UI or anonymous access. All actions and loaders authenticate and scope queries
by the session user. Actions return `{ success, id }` or `{ error }`; loaders
return `{ success, ...data }` or `{ error }`. Validate loader errors before rendering
empty states. Money inputs/derived outputs use integer satang. Database amount
fields in returned ledger/receivable rows retain baht; use `amountCents` /
`netReceivableCents` for calculations.

- `actions.ts`: `createInvoice`, `updateInvoice`, `markInvoiceSent` (alias
  `sendInvoice`), `voidInvoice`, `markInvoicePaid`.
- `queries.ts`: `getReceivablesSummary(today)`; calendar date in the user's timezone.
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
