# W6 local slip batch logic — UI handoff

No UI, server actions, schema or existing scan flow changed. Do not wire the new
path to scanReceipt. Import processSlipBatch and inject recognizeSlipText,
localSlipQRDecoder.decode, and a candidate query. Pass an explicit sender/receiver
perspective from account selection; never infer ownership from a Thai name or a
masked account suffix. Own-account transfers remain unsure and need the existing
transfer form (capture save only supports income/expense). Candidate fetch failure
aborts the batch; it must never silently mean “no duplicates”. Progress is per
completed image plus matching/done. Cancellation is checked between operations;
an active OCR call finishes and terminates before cancellation is observed.

Results contain extracted fields only, no image, URL or full OCR text. Callers
must release their File[]/picker state after completion/cancellation and must not
persist them. Images are processed sequentially. The OCR worker is isolated in a parent worker with a two-minute timeout; terminating
the parent also cleans up nested workers after initialization errors. It terminates after
each image and has no IndexedDB cache. QR canvases/URLs are released. Browser
HTTP caching of static OCR assets is fine; images are never uploaded.

Use buildSlipSaveInput or saveReadySlips with the existing save action injected by
the UI. Select account/category separately for each item. Keep results (including
errors) for retries; the stable clientRequestId is persisted as client_request_id
by the unchanged action. Amount is integer satang. OCR confidence is not category
confidence: unconfirmed categories remain in the inbox.

Distinct explicit references override the matcher's amount/time duplicate hint.
DB DATE-only rows cannot prove time duplicates; references remain the strongest
cross-import key. With no reference, IDs hash normalized amount/date-time/direction/
parties; two genuinely identical no-reference slips are inherently ambiguous and
can share an ID. Repeated identical fields without time duplicate evidence are
held as unsure; review them and use a fresh request UUID for an explicitly confirmed
separate payment. This phase does not claim guaranteed payment identity.
CRC validates payload integrity, not authenticity or actual movement of money.
Standard bank QR only; TrueMoney variant is unsupported. Strict TLV length checks
reject truncated payloads (including banks' malformed shortened CRCs).

## Provision self-hosted assets before enabling UI

Registry DNS/network is unavailable in the implementation sandbox, so no npm
runtime dependency/lockfile is added. Both libraries load only on first local use
from same-origin static assets. Tesseract uses native dynamic import (excluded
from webpack); jsQR's UMD distribution uses a lazy script loader. Neither is in
the initial application bundle. This is an explicit deployment prerequisite;
missing assets cause a local read error, with no external fallback.

On a network-enabled build machine, run:

```sh
node scripts/prepare-slip-assets.mjs
```

The script uses temporary npm packs, pins jsqr 1.4.0 (Apache-2.0), Tesseract.js
7.0.0 and core 7.0.0 (Apache-2.0), copies licenses, browser API/worker, all WASM
core variants and downloads tha+eng LSTM models from the official tessdata source.
No installation or package.json change. Generated public/ocr is intentionally
ignored: publish it alongside the app or provision it before next build. Serve
JS as JavaScript and WASM as application/wasm. Allow same-origin worker/script
loading in CSP. The script reports exact byte totals (models/core are several MB;
not measured here because downloads are blocked). Cache these versioned deployment
assets with your normal static asset policy. Offline use requires them to have
been loaded/cached beforehand; no service-worker precache is added in this phase.

Format references: [SCB mini-QR](https://developer.scb/assets/documents/documentation/qr-payment/extracting-data-from-mini-qr.pdf),
[wire layout](https://thai-qr-payment.js.org/guide/slip-verify/).
OCR hosting: [Tesseract local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).

Synthetic tests are logic coverage only. Accuracy/speed on 10–20 redacted real
slips on a phone remains the release gate. No real slips were available here.

## Verification checkpoint / handoff

Branch: codex/w6-slip-batch-logic, based on origin/staging (no local staging ref).
AI_COLLABORATION.md intentionally unchanged per task instruction. Codex owns
logic; Claude owns the later UI wiring and review screens. No commit/push.
Existing parser/matcher/actions/scanReceipt and quick-add/capture layouts untouched.

Verification uses PATH=/tmp/n22bin:$PATH (Node 22.23.3); the default shell was Node 20.
Typecheck and lint pass; full Vitest and NLP evaluation pass (see final handoff
for counts). Build attempted but blocked: Next's TypeScript CLI subprocess
returns exit 0 with empty captured stdout for --showConfig, so Next cannot parse
configuration; direct node typescript/bin/tsc --showConfig succeeds. No app/config
workaround added. Network DNS blocks npm registry, so asset provisioning and real
browser OCR/QR decoding have not been exercised. Zero added npm dependencies;
initial vendor bundle impact is zero until the UI imports the adapters. Actual
static asset bytes are printed by the provisioning script, not measured here.

Next action: run node scripts/prepare-slip-assets.mjs on a network-enabled machine,
then measure Thai OCR accuracy and time on real redacted slips on a phone before
Claude enables batch import UI. Preserve explicit perspective/account confirmation,
unsure/duplicate review and selective retry handling.

Final verification: npm run typecheck PASS; npm run lint PASS (final QR adjustment
also passes focused ESLint); npx vitest run PASS — 162 files / 2,378 tests,
including 44 added tests; npm run nlp:eval PASS — 358 corpus cases,
autoSavePrecision=1, criticalFailures=[]. git diff --check PASS. Self-review used
origin/staging plus all untracked additions (no local staging branch exists).
