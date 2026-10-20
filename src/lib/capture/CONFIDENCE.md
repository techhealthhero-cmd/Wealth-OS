# Capture confidence, first slice

`evaluateCaptureConfidence(parsed, context)` is pure, deterministic TypeScript.
Pass the original `text`, the same parser context and the parsed result. It returns
field evidence (value, reliability, source, candidates), stable reasons and at most
one Thai question. `level` is presentation only. No network, storage or AI is used.

Automatic eligibility requires reliable amount, direction, date and account.
Category is non-blocking. Today is the capture date when no date is mentioned;
an invalid named date cannot inherit the parser's fallback to today. The default
account requires both `defaultAccountEstablishedByUser: true` and the matching
`defaultAccountId`. Neither array order nor category confirmation establishes it.
`duplicateUncertain` is supplied by a caller that has duplicate evidence; this
module does not infer duplicates from equal transaction contents.

## Reasons and single-question priority

The exported `REASON_PRIORITY` order is the public deterministic priority:

| Priority | Code | Question field |
|---|---|---|
| 1 | `emergency_account_unresolved` | account |
| 2 | `conflicting_amounts` | amount |
| 3 | `missing_amount` | amount |
| 4 | `invalid_date` | date |
| 5 | `unresolved_date` | date |
| 6 | `default_account_guess` | account |
| 7 | `subscription_account_unresolved` | account |
| 8 | `subscription_false_positive_risk` | subscription |
| 9 | `ambiguous_direction` | direction |
| 10 | `duplicate_uncertain` | duplicate |

All reasons block automatic eligibility. Account guesses include absent/archived
accounts, competing account mentions and unconfirmed merchant account suggestions.
Invalid/future named dates and unsupported or competing date expressions block.
Multiple different monetary values block rather than trusting the last number.
Unit-derived amounts reuse the parser's count and established price. More complex
quantity/total explanations can conservatively ask for the amount.
Direction contradictions, bare unexplained amounts, internal transfers, cancellation
commands and smart purchase/loan plans need their own focused resolution.

Known service identity alone never authorizes a recurring signup through this gate.
Explicit signup/cadence evidence is required; negation, history, trial and one-off
wording still block. The legacy subscription parser and its save mapping are
unchanged in this slice: **callers must use the gate before enabling auto-save**.

`createConfidenceDraft` preserves emergency flags and attaches `confidenceGate`.
The new draft fields are optional for compatibility. Existing UI constructors,
manual save eligibility, server actions and recap parsing remain unchanged. Recap
items already extend `ParsedCapture`, so emergency flags are retained there.
After any user correction, reparse/re-evaluate using the corrected source/context;
a stored gate result can be stale and must not itself authorize a later save.

## Corpus and measured baseline

Run `npm run nlp:eval`. No new dependency is needed: a Node runner invokes Vitest,
prints the fresh JSON report and removes its temporary report directory. The full
suite runs the same assertions. The fixture and measured thresholds are under
`tests/fixtures/nlp/`.

The v1 development corpus contains 320 synthetic cases, with 30 each for unresolved
emergency accounts, default guesses, invalid dates, amount conflicts and service-name
false positives. It also covers explicit subscriptions, unresolved subscription
accounts, linked emergency draws, income/refunds, transfers, Thai digits, relative
dates, mixed English, slang/typos, missing amounts and duplicates. Identical text
with different account/consent contexts is intentional. Labels were specified from
sentence semantics rather than generated from parser predictions. No real names,
account numbers or production data are included. Families share templates; this is
not an independent held-out estimate of real-world precision.

| Metric | Baseline |
|---|---:|
| Cases | 320 |
| Critical failures | 0 |
| Auto-save precision | 100% (124/124) |
| Auto-save coverage | 38.75% (124/320) |
| Clarification rate | 61.25% (196/320) |
| Uncertainty recall | 100% (190/190) |
| Exact match | 41.875% (134/320) |
| Amount accuracy | 90.625% |
| Direction accuracy | 91.875% |
| Date accuracy | 89.0625% |
| Account accuracy | 76.5625% |
| Category accuracy (276 labelled cases) | 89.1304% |
| Eligibility / question accuracy | 98.125% |

Per-field accuracy scores only labelled fields. `null` labels mean the field is
unresolved and must not be guessed; the legacy parser's fallback is counted as a
field error even when the gate correctly asks. Exact match requires all labelled
fields including category to match an expected value or acceptable alternative.
Auto-save precision requires correct amount/direction/date/account on every saved
case; unlabelled required fields cannot qualify as correct. Zero-save slices have
`null` precision rather than a fabricated 100%. Coverage is auto-saved/all cases;
clarification is its complement. Uncertainty recall is blocked/expected-uncertain.
A critical failure is any automatic capture with a wrong required financial field,
or automatic eligibility on an expected-unsafe priority case. Every slice is
reported; thresholds freeze the measured baseline both overall and per slice.

Six safe income sentences are blocked because the legacy parser reads
“รับเงินงานออกแบบ” as expense. This is an explicit parser limitation; labels were
not changed to match it. The new gate catches the contradiction. The legacy
parser also assigns subscription categories to 30 service-name false positives;
these are labelled Other and counted as category errors, while the gate blocks
the recurring interpretation. The 100% precision
claim applies only to this small synthetic corpus. Vocabulary/date coverage and
unsupported financial intents require expansion and independent evaluation.

## Follow-ups

- UI wiring in Quick Capture / Voice Notebook: evaluate at completion, ask one
  question, re-evaluate corrections, auto-save when eligible and provide undo.
- Retire capture `ai-fallback` / `AIReceiptParser` orchestration and paid inference.
- Device snapshots, versioned storage/outbox, retry/idempotency and user isolation.
  Any schema/migration/server storage changes: **NEEDS USER APPROVAL**.
- Local speech capability detection and offline text fallback; device tests.
- Expand to thousands of consented/de-identified labelled examples; separate template,
  speaker and source families between development and held-out sets; latency tests.
- Improve income markers, recurring negation/history, transfer resolution, quantities,
  calendar expressions and account evidence against independent labels.
- New server provenance, emergency audit, telemetry, corpus collection or any other
  schema/migration/server storage changes: **NEEDS USER APPROVAL**.

## Device merchant memory (W1)

`ParseContext.deviceMemory` supplies a versioned snapshot from
`createMerchantMemory(userId)`. The repository reads/writes only localStorage,
uses separate user buckets (no anonymous bucket), ignores corrupt/old schemas and
caps observations at 300 keys by recency. `forget(key)` and `clear()` are available
for a future settings control. Unavailable browser storage fails without affecting
transaction saves. Nothing is sent to a new server endpoint.

Keys are normalized contiguous merchant/context phrases, without amounts, dates,
currency, filler verbs or account tokens. Matching uses normalized substrings,
longest first; 7-11/7-Eleven/เซเว่น share an alias. Context phrases remain distinct,
so marketplace purchases can have different categories. Votes store category and
direction together. An explicit correction reduces competing weights and immediately establishes a reliable winner. Different corrections within ten minutes retain conflicting weights and ask for a choice. A winner needs
at least 75% of weighted history; a tie or weaker majority contributes
`memory_conflict`, marks category evidence unreliable and blocks automatic saving.
Explicit category words outrank device memory and merchant defaults. Deleted,
archived and incompatible categories cannot supply device evidence.

Reliable device evidence can resolve a previously unexplained direction and makes
category evidence reliable. It does not resolve amount, date, account, duplicate,
foreign-currency or hypothetical/contradictory evidence. Existing server preference
behavior remains available when no device rule applies, but explicit category words
also outrank legacy substring preferences and conflicting exact merchant preferences.

Both confirm-card flows learn only after a successful explicit Save, comparing the
final category/type against the reading displayed before edits. An explicit category
choice is always a correction, even if a later AI reading matches that choice.
Identity is resolved from the live auth ref or browser session at save completion,
so a handler captured before auth hydration can still learn. Predictions alone,
failed saves, cancelled items, unresolved readings and smart/receipt captures do not
teach this memory. Undo restores the exact prior entry snapshot only while that save’s revision is still present; cleared, evicted or subsequently replaced entries are left alone. A conflicting device match
shows a category question and requires a category choice; voice hands off to the
existing full confirm card. Manual saving otherwise retains its existing behavior.
