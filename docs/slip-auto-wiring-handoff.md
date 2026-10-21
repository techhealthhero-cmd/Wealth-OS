# Slip auto wiring handoff — 2026-10-21

Owner: Codex. Branch/worktree: `claude/slip-auto-ui`, `/tmp/wos-slip-ui`.
Implementation and synthetic checks complete; authenticated browser/OCR acceptance
and a successful production build remain unverified. Supervisor owns review,
commit, push and staging deployment. No commit/push, DB writes, migrations,
auth/RLS/billing changes or financial-formula edits were performed.
`AI_COLLABORATION.md` was read and intentionally left unchanged, as explicitly
required by the supplied brief. This document is the work claim and handoff.

## Completed wiring and files

- `src/features/capture/components/slip-auto/slip-auto-flow.tsx`: live controller
  for pick, local OCR/QR, reading progress/recent extracted items, review,
  save, saved state, whole acknowledged-batch undo and monthly detail. Account
  selection, per-item amount/date/account/reference repair and an existing
  transfer-form handoff are supplied without changing Claude's visual classes.
  Closing the sheet keeps work in memory; the button badge reopens it. No push.
- `src/features/capture/lib/slip-auto-model.ts`: engine-to-VM mapping, rule/device
  category suggestions, unsure-first save payloads, expense defaults, validation,
  duplicate exclusion and retryable per-row undo. Existing category and financial
  functions remain authoritative. Answered questions expose the existing category
  chips; overlapping question/ready IDs count once in Save all.
- `src/features/capture/slip-auto-actions.ts`: authenticated, privacy-gated,
  user-scoped and paginated candidate reads by dates plus independent reference
  lookup (so a wrong OCR date cannot hide an existing reference). Read errors
  abort duplicate checking. Only extracted dates/references reach this action.
- `src/features/capture/lib/slip-batch-import.ts`: optional extracted-field
  `onItemRead` callback; the processing/saving engine otherwise stays unchanged.
- `src/features/capture/use-merchant-memory.ts`: explicit slip corrections use
  the existing signed-in device memory repository and its conditional undo.
  Nothing is learned from unconfirmed default categories. Income/expense ownership
  is never inferred from a party name or device memory.
- `src/features/capture/actions.ts`: additive optional `inserted` result field
  distinguishes new rows from idempotent replays. The existing save action still
  validates/persists receipt source, slip reference, client_request_id, categories,
  accounts and inbox status. Existing `scanReceipt` implementation remains intact.
- `src/features/capture/components/quick-capture-sheet.tsx` and
  `src/features/transactions/components/quick-add.tsx`: Home scan accepts many
  images; the Quick Capture camera sends one image; its library action opens the
  supplied pick sheet. These entry points use local processing and do not import
  or call `scanReceipt`. Quick Capture's unrelated text/voice behavior is retained.
- `src/features/capture/components/slip-auto/{format,types,slip-pick-sheet,
  slip-review-sheet,slip-saved-state}.tsx/ts`: mapping/format contracts, callback
  documentation, unique save count and an optional review controls slot. Existing
  className/layout/color/copy styling is unchanged.
- `src/features/dashboard/lib/monthly-spend.ts`: deterministic month boundaries,
  calendar navigation, category/date-filter links and aggregation. Totals reuse
  calculateExpenses (net of refunds), calculateIncome and calculateMonthlyCashFlow.
  Categories reuse existing gross expense-only calculateSpendingByCategory;
  income, transfers, debt payments, savings and investment movements are excluded.
- `src/features/dashboard/monthly-spend-actions.ts`: real paginated monthly reads,
  explicit session-user scoping, existing privacy gate and existing categories.
- `src/features/dashboard/components/monthly-spend.tsx`: card/detail composition,
  refetch on month switch, stale-response suppression and transaction navigation.
- `src/features/dashboard/components/{monthly-spend-card,monthly-spend-detail}.tsx`:
  resolved callback/query documentation only; Claude's presentation is preserved.
- `src/app/(app)/dashboard/page.tsx`: real monthly summary under net worth.
  Existing save/delete revalidation plus router.refresh updates the dashboard.
- `tests/slip-auto-wiring.test.ts`, `tests/slip-auto-queries.test.ts`: 17 additional
  cases covering mapping, default expense even against learned income, unique
  counts/order, category correction/payloads/idempotency keys/reference/source,
  invalid-field guards, transfer exclusion, undo failures/retry, financial semantics,
  month switches, routes, no-AI entry-point imports, privacy/auth/user scope,
  pagination and fail-closed candidate/summary reads.

## The ten TODO markers

1. Pick-sheet multi-select: processSlipBatch with local OCR and QR dependencies.
2. Pick-sheet camera: the same pipeline with a one-file batch.
3. Types engine mapping: slip-auto-model; progress/recent items from the engine.
4. Saved-state undo: track each new transaction ID/request ID; call the existing
   deleteTransaction path for the entire acknowledged batch. Failures remain
   available for another undo attempt; prior-import replays are never deleted.
5. Types monthly query: monthly-spend-actions plus existing financial functions.
6. Monthly card query: dashboard supplies actual saved data.
7. Detail month navigation: refetches the chosen calendar month.
8. Detail category action: `/money/transactions?month=YYYY-MM&from=...&to=...&type=expense&categoryId=...`.
9. Dashboard integration: real summary, detail controller and scan wiring above.
10. `copy.ts` i18n migration: intentionally retained, as allowed by the brief;
    moving the supplied Thai copy would broaden this logic-only change.

## Verification

Node: supplied `/workspace/.node22/bin`, v22.23.3 (non-login shell).

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, no warnings.
- `npx vitest run`: PASS, **165 files / 2,400 tests**.
- `npm run nlp:eval`: PASS, 358 cases, autoSavePrecision=1,
  criticalFailures=[].
- `npm run build`: attempted; blocked by the already documented environment
  failure, `Could not parse output from TypeScript's --showConfig`.
- `git diff --check`: PASS. Self-reviewed tracked changes against origin/staging
  and reviewed all new modules/tests separately (untracked files do not appear in
  that diff). Existing Claude UI commits and unrelated staging differences were
  preserved. No shared-board edit or Git mutation.

## Local authenticated acceptance

1. On a network-enabled build machine, run
   `node scripts/prepare-slip-assets.mjs` before building/deploying. This
   provisions same-origin `public/ocr` scripts, WASM, Thai/English models and
   licenses. The provisioning attempt here failed at `spawnSync npm EPERM`;
   a direct npm-pack attempt also failed. The assets remain absent.
2. Configure the normal local environment for **staging**, run `npm run dev`,
   and sign in with a staging test user who has at least one active account.
   Existing categories are used; no new seed/migration or special test login was
   created. An account is required for real saves; create one through the normal UI
   if needed. Unlock activity/overview privacy before testing these reads.
3. At `/dashboard`, tap “สแกนสลิป” and select several redacted slips. Alternatively
   open Quick Capture, choose its image action for the supplied multi-pick sheet,
   or take one camera image. Observe progress and recent extracted fields.
4. Close reading with “ไว้ดูทีหลัง”; reopen using the badge. Review the unsure
   questions first, choose income/expense, change categories and account, repair
   missing amount/date/reference as needed. “โอนระหว่างบัญชี” hands that item to
   the existing transfer form rather than posting it as an expense. Confirm the
   transfer through that form separately.
5. Save all. Verify real income/expense rows on `/money/transactions`, their
   receipt source/reference, duplicate skip and current-month card refresh. Undo
   and verify rows are actually absent and dashboard/account totals refresh.
6. Open the monthly card; change months, expand a category and follow its link.
   Uncategorized has no supported category-null URL filter, so that link uses the
   selected month's expense list without categoryId.
7. `/dev/slip-auto-preview` remains the supplied presentation fixture preview;
   it is not an authenticated save/OCR test.

## Limits / release gates

- No authenticated browser/device run or real slip accuracy/speed measurement
  was possible with missing OCR assets. Do not claim OCR works locally yet.
- Static assets are same-origin, not external AI. They require provisioning and
  prior browser loading/caching for offline availability; this change adds no
  service-worker precache. Real saves/duplicate checks/monthly reads require the
  server. Images are memory-only and discarded after processing; a full reload
  discards the in-memory pending batch. Sheet close/app navigation can resume
  while the shared controller stays mounted.
- Undo is for acknowledged new inserts in the current live batch. An idempotent
  replay is deliberately never deleted; a server commit whose response was lost
  before acknowledgement may therefore require normal transaction-list deletion.
  This favors avoiding deletion of a prior import over guessing row ownership.
- No-reference identical slips have inherently ambiguous identity. Within a review,
  repeated identical nonduplicate items receive separate keys; references retain
  the engine's stable cross-import keys. Existing engine duplicate heuristics apply.
- No comparison insight is invented (`insight: null`). Monthly headline spending
  is net of refunds while the category distribution remains gross expenses, matching
  the existing financial helpers. Categories are ordered by actual spending.
- ASK USER: none. No schema change is required for the implemented flow.

Resume Packet: code/checks are complete as above; the first next action is to
provision OCR assets on a machine that can run npm packs/downloads, then run the
staging authenticated phone acceptance steps before the supervisor commits/pushes.

## Follow-up fix 1 — 2026-10-21

Owner: Codex; complete, ready for supervisor review; no commit/push.
Scope: parse.ts normalization and exact OCR regression tests only; existing
wiring and UI preserved. Applied NFC and explicit U+0E4D U+0E32 → U+0E33 before
matching. Both verbatim ocr-out.txt slips now yield 6500/80000 cents,
2026-10-21 and E2E145587A/C. Existing uppercase account matching is covered for
both parties; no account regex change was necessary.

Save all audit: slipSavePayloads validates the entire batch before any write.
A missing amount/date/invalid reference throws the existing message
“กรุณาแก้ไขจำนวนเงิน วันที่ และเลขอ้างอิงของสลิปที่อ่านไม่ชัดก่อนบันทึก”.
The flow catches it, calls toast.error, returns and stays in review, saving none.
The app mounts the existing top-center Sonner toaster (z-index 999999999),
above the review overlay. Confirmed by source inspection; no new device run.

Node 22.23.3: typecheck PASS; full Vitest PASS (165 files / 2402 tests);
NLP eval PASS (autoSavePrecision=1, criticalFailures=[]).
Requested npm run lint FAIL: provisioned third-party public/ocr JavaScript
produces 56 errors / 3772 warnings. These assets were not changed by this fix.
Shared collaboration board remains unchanged per the supplied brief.
Next: supervisor review and repeat real WebKit OCR/save acceptance.

## Review pass — 2026-10-21 (complete)

Owner: Codex; READY FOR HANDOFF. Scope: uncommitted logic review, regression tests,
offline asset preparation, lint/build/typecheck/full Vitest/NLP evaluation.
Plan: inspect diff and new files → minimal bug fixes → required checks → handoff.
UI classes/copy, DB/auth/RLS/billing/formulas and commit/push are excluded.
Shared board remains unchanged per the explicit review brief.

Review result: no additional confirmed wiring bugs in user scope, duplicate saves,
undo row ownership, direction/sign, server/client boundaries or monthly reads.
Fixed the build's network dependency in scripts/prepare-slip-assets.mjs: copies
pinned jsqr/Tesseract/core/Thai+English model packages from node_modules instead
of npm pack and GitHub fetches. package.json/package-lock.json pin the five new
build dependencies. Model files now use the packaged 4.0.0_best_int variants;
real-device OCR accuracy remains an acceptance check. No UI edits in this pass.

Added an isolated empty-output asset preparation test with fetch forbidden and
PATH empty; validates scripts/notices, WASM magic and decompressible language
models. Added three server-query regressions at Bangkok month/year rollover.

Node 22: npm run lint PASS (public/ocr/** ignore verified); npm run build PASS
including offline prebuild; final npm run typecheck PASS; full Vitest PASS
(166 files / 2406 tests); npm run nlp:eval PASS (358 cases,
autoSavePrecision=1, criticalFailures=[]); git diff --check PASS.
All checks exited zero. Earlier build/lint/asset blockers above are superseded.
No commit/push, migrations, RLS/auth/billing or financial formula changes.
Next handoff: supervisor reviews the local patch and runs authenticated phone
acceptance before staging deployment. No unfinished implementation work.
