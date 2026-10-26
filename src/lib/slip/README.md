# Portable e-slip logic

Import `parseSlipText`, `matchSlipToTransactions`, and `BankCode` from `@/lib/slip`.
No OCR engine is included: callers supply plain OCR text. No source text is retained,
transmitted, or logged. This module uses only portable TypeScript/JavaScript and the
existing exact money and pure statement-date helpers.

`parseSlipText(text, { referenceYear?: number })` returns nullable amount/fee in
integer satang, sender/receiver objects, reference, date, Bangkok ISO timestamp,
per-field confidence and overall confidence. Confidence is a heuristic evidence
score, not a calibrated probability; overall confidence averages all fields,
including optional ones. Missing time leaves `dateTime` null while retaining `date`.
Short years resolve to the CE/BE reading nearest `referenceYear` (fixed default
2026); four-digit BE years are converted directly. Input is limited to the first
100,000 characters. Numeric OCR correction never modifies names or references.

`matchSlipToTransactions(slip, rows, options)` accepts the database transaction
shape (decimal-string `amount`, `transaction_date`, `type`, `id`, optional reference
and currency) with optional enriched `account` and `bank` hints. These hints refer
to the owner's account. `perspective` defaults to `sender` (expense); `receiver`
expects income. Amount tolerance is in integer minor units (default zero), time
window in minutes (default 1440), duplicate window in seconds (default 60).
Date-only rows compare Bangkok calendar days and never supply duplicate time
evidence; `created_at` is never used. Missing/invalid dates provide no date score.
Identical trimmed, case-insensitive references bypass amount/date gates to expose
inconsistent records. Non-THB rows and invalid/negative amounts are excluded.
Ties retain input order. No clock access, mutation, or persistence occurs.

Reasons are stable codes describing evidence (for example `amount_exact`,
`direction_mismatch`, `duplicate_reference`). Scores are clamped to 0..1.
Duplicates are suggestions for review, never instructions to delete a record.

Limitations: this is a label-based heuristic, not a bank layout classifier. It
reads amount from จำนวน/จำนวนเงิน/ยอดโอน or a บาท/THB marker, including K PLUS
lines where the amount sits under `จำนวน:`. Dates accept พ.ย.-style abbreviations
even when OCR turns the dot into sara u. Sender/receiver come from จาก/ไปยัง (or
from/to) labels, or from two stacked account blocks when those labels are absent.
Account and name on separate lines give the best results;
unlabelled columns or bank/name on the same line may need review. Combined fee and
amount on one line are unsupported. Masked account hints compare at least three
visible trailing digits and may collide. Reference identifiers are preserved
rather than OCR-corrected to avoid inventing identity. Minute-only times have
second zero precision; same-amount payments in that minute can be duplicate
suggestions. No actual slip images or real personal data are used by tests.
