# WEALTH OS — Codex × Claude Collaboration Board

ไฟล์นี้คือพื้นที่กลางสำหรับ Codex, Claude และ Grok Bot ใช้ส่งต่องาน แบ่งหน้าที่ และบันทึก
สถานะล่าสุดของโปรเจกต์ เจ้าของโปรเจกต์ไม่จำเป็นต้องคอยเล่าบริบทเดิมซ้ำให้แต่ละฝ่าย

> ทุก agent ต้องอ่านไฟล์นี้ก่อนเริ่มงาน และอัปเดตส่วนที่เกี่ยวข้องก่อนจบงาน
> หากข้อมูลสถานะขัดกับโค้ดหรือไฟล์จริง ให้ตรวจหลักฐานแล้วแก้ไฟล์นี้ให้ตรงกับความจริง

## เป้าหมายร่วม

ทำให้ WEALTH OS เป็นผลิตภัณฑ์การเงินที่ชัดเจน อบอุ่น น่าเชื่อถือ และใช้งานได้จริง
โดยให้ภาพ ภาษา หน้าจอ และพฤติกรรมของระบบเป็นประสบการณ์เดียวกัน

ลำดับคุณค่าที่ใช้ตัดสินใจร่วมกัน:

1. ความถูกต้องและความปลอดภัยของข้อมูลการเงิน
2. ความเข้าใจง่ายและผลลัพธ์ของผู้ใช้
3. ความสม่ำเสมอของประสบการณ์และภาพลักษณ์
4. ความสวยงาม
5. ความเร็วในการส่งมอบ

## จุดแข็งและบทบาทหลัก

### Codex — Visual direction, artwork และการตรวจเชิงระบบ

Codex เป็นเจ้าภาพหลักเมื่อเนื้องานเกี่ยวกับ:

- คิดแนวภาพ วาดภาพ และสร้าง visual variants
- รักษาภาษาภาพ สี เส้น พื้นผิว และความต่อเนื่องระหว่างชุด
- จัดทำ artwork roadmap, production brief, asset map และชื่อไฟล์
- ตรวจความหมายของภาพเมื่อย่อบนมือถือ รวมถึง light/dark mode
- วิเคราะห์โค้ด ทดสอบ และตรวจผลกระทบข้ามระบบเมื่อได้รับมอบหมาย
- เตรียมไฟล์ต้นฉบับให้พร้อมสำหรับการติดตั้ง

Codex ต้องส่งต่อให้ Claude อย่างน้อย: ไฟล์ต้นฉบับ, จุดประสงค์, หน้าปลายทาง,
ขนาดหรืออัตราส่วน, safe area และสิ่งที่ห้ามเปลี่ยน

### Claude — Product UI, composition และการติดตั้งในแอป

Claude เป็นเจ้าภาพหลักเมื่อเนื้องานเกี่ยวกับ:

- นำ artwork ไปจัดองค์ประกอบร่วมกับข้อความและ UI จริง
- ตกแต่งหน้าจอให้สวย อ่านง่าย และสอดคล้องกับ design system
- เชื่อม asset เข้ากับ component, state และ interaction ที่ถูกต้อง
- ดูแล responsive layout, accessibility, performance และ localization
- ตรวจว่า artwork ไม่แย่งลำดับชั้นจากข้อมูลสำคัญหรือ CTA
- รันการตรวจทางเทคนิคของงานที่ติดตั้งและแจ้งข้อจำกัดกลับมา

Claude ต้องไม่แก้ character, สีหลัก, silhouette หรือความหมายของ artwork โดยพลการ
หากต้องเปลี่ยนสาระของภาพ ให้เขียนข้อจำกัดและส่งกลับให้ Codex ปรับ master

### Grok Bot — Automation, monitoring และงานกะกลางคืน

Grok Bot เป็นเจ้าภาพหลักเมื่อเนื้องานเกี่ยวกับ:

- รัน test/typecheck/lint/build ตามตารางและรายงาน regression
- เฝ้าดูงานซ้ำ เช่น broken links/assets, flaky tests และเอกสารสถานะคลาดเคลื่อน
- รับงาน maintenance ที่มีสถานะ `APPROVED FOR AUTO` บน branch/worktree แยก
- เตรียม diagnosis, patch และ Resume Packet ให้ Codex/Claude ตรวจรับ

Grok Bot ไม่มีอำนาจเปลี่ยน product direction, production data, migrations, RLS, auth,
billing หรือ financial formulas เอง ขอบเขตและกฎเริ่มต้นอยู่ใน `GROK_BOT_ONBOARDING.md`

### เจ้าของโปรเจกต์ — Product owner และผู้อนุมัติสุดท้าย

- กำหนดเป้าหมายและลำดับความสำคัญ
- เลือกทิศทางเมื่อต้องแลกระหว่างความสวย ความเร็ว และความชัดเจน
- อนุมัติภาพหรือหน้าจอที่มีผลต่อทิศทางผลิตภัณฑ์
- ความเห็นล่าสุดของเจ้าของโปรเจกต์มีลำดับสูงสุด

บทบาทข้างต้นเป็นค่าเริ่มต้น ไม่ใช่กำแพง ทุก agent ช่วยงานอีกฝ่ายได้เมื่อเหมาะสม
แต่ต้องมีเจ้าภาพเพียงคนเดียวต่อหนึ่งงาน เพื่อป้องกันการแก้ทับกัน

## วิธีทำงานร่วมกัน

1. อ่าน `CLAUDE.md`, เอกสารเฉพาะงาน และไฟล์นี้ก่อนเริ่ม
2. สรุปแผนที่มีเป้าหมาย ขอบเขต ขั้นตอน และเกณฑ์เสร็จก่อนลงมือ
3. ตรวจ `git status` และไฟล์จริง ห้ามถือว่าสถานะในเอกสารถูกต้องโดยไม่ตรวจ
4. เลือกงานจากตาราง Active Work แล้วใส่ชื่อตนเองเป็น Owner ก่อนแก้ไข
5. แก้เฉพาะไฟล์ใน Scope หลีกเลี่ยงไฟล์ที่อีกฝ่ายกำลังถือครอง
6. ถ้าพบ dependency หรือข้อจำกัด ให้เพิ่มใน Blockers / Decisions ทันที
7. ตรวจงานตาม Definition of Done ของงานนั้น
8. ก่อนจบ ให้ปรับสถานะและเขียน Handoff Note ที่กระชับแต่ทำต่อได้ทันที

สถานะมาตรฐาน: `TODO` → `IN PROGRESS` → `READY FOR HANDOFF` → `VERIFY` → `DONE`

## กติกาป้องกันงานชนกัน

- หนึ่งงานมี Owner คนเดียว ผู้ช่วยให้ระบุใน Notes
- ห้ามแก้หรือย้อนงานที่อยู่นอก Scope ของตนโดยไม่มีเหตุผลบันทึกไว้
- ห้ามลบหรือเขียนทับการเปลี่ยนแปลงที่มีอยู่โดยไม่ทราบเจ้าของ
- Artwork master อยู่ใน `assets/artwork/masters/`; ไฟล์ใช้งานอยู่ใน `public/artwork/`
- Codex ตัดสินใจเรื่อง master artwork; Claude ตัดสินใจเรื่อง layout รอบ artwork
- เรื่อง product behavior, financial logic หรือ security ต้องอิงโค้ดและการทดสอบ
- ถ้าความเห็นต่างกันและมีผลต่อทิศทาง ให้เสนอทางเลือกพร้อมผลดี/ผลเสียแก่เจ้าของโปรเจกต์

## Token & Continuity Protocol

Codex เป็นเจ้าภาพดูแลการใช้ token และความต่อเนื่องของงาน ทุก agent ต้องทำตามกติกานี้:

### ก่อนเริ่มงาน

- แปลงคำสั่งให้เป็นแผนที่มีผลลัพธ์ปลายทาง ขอบเขต ลำดับงาน และ Definition of Done
- แบ่งงานยาวเป็น checkpoint ที่จบเป็นช่วง ๆ และตรวจสอบได้
- อ่านเฉพาะไฟล์ที่เกี่ยวข้องก่อน แล้วขยายบริบทเมื่อมีหลักฐานว่าจำเป็น
- ตรวจงานเดิมก่อนสร้างใหม่ เพื่อป้องกันการวิเคราะห์หรือการลงมือซ้ำ
- กำหนด Owner คนเดียว และระบุว่าใครเป็นผู้ตรวจรับช่วงถัดไป

### ระหว่างทำงาน

- อัปเดต Active Work เมื่อผ่าน checkpoint สำคัญ ไม่รอจนจบงานทั้งหมด
- เก็บรายละเอียดที่ต้องใช้ต่อไว้ในไฟล์โปรเจกต์ ไม่พึ่งความจำจากบทสนทนาเพียงอย่างเดียว
- ส่งต่อเฉพาะบริบทที่จำเป็น: เป้าหมาย ไฟล์ ข้อจำกัด การตัดสินใจ ผลตรวจ และขั้นต่อไป
- หยุดขยายขอบเขตโดยอัตโนมัติ หากพบงานใหม่ให้บันทึกเป็น Next Step ก่อน
- คุณภาพและความถูกต้องมาก่อนการประหยัด token ห้ามข้ามการตรวจที่จำเป็น

### เมื่อใกล้ถึงลิมิตหรือต้องหยุดกลางงาน

- หยุดที่ checkpoint ที่ปลอดภัย ห้ามทิ้งไฟล์ในสภาพที่รู้ว่าเสียหรือใช้งานไม่ได้
- อัปเดต Active Work ด้วยสถานะจริงและระบุ checkpoint ล่าสุด
- เขียน Resume Packet ใน Handoff Log ก่อนจบทุกครั้งที่ทำได้
- ระบุคำสั่งหรือการตรวจที่รันแล้วและผลลัพธ์ ห้ามให้ผู้รับช่วงรันซ้ำโดยไม่จำเป็น
- ระบุขั้นตอนแรกเพียงหนึ่งขั้นที่ควรทำทันทีเมื่อกลับมาทำต่อ

### เมื่อกลับมาหลังลิมิตรีเซ็ตหรือเริ่ม session ใหม่

1. อ่าน Resume Packet ล่าสุดและรายการ Active Work
2. ตรวจ `git status` และยืนยันว่าไฟล์จริงยังตรงกับ checkpoint
3. ห้ามเริ่มวางแผนใหม่ทั้งหมดหากแผนเดิมยังใช้ได้
4. ทำต่อจาก `Next action` และอัปเดตสถานะเมื่อผ่าน checkpoint ถัดไป

ข้อจำกัดที่ต้องสื่อสารตรงไปตรงมา: Agent ไม่สามารถตื่นขึ้นมาทำต่อเองเพียงเพราะ
ลิมิตรีเซ็ตได้ เว้นแต่มีระบบ automation เรียกงาน เมื่อผู้ใช้กลับมาสั่งต่อหรือมีระบบเรียกงาน
ต้องทำต่อจาก Resume Packet โดยไม่ให้ผู้ใช้เล่าบริบทเดิมซ้ำ

## Active Work

- HOME-REMOVE-SHORTCUTS-INCOME — Owner: Grok Bot; IN PR → staging. Owner asked to remove the Home shortcut row (ออกใบแจ้งหนี้, บันทึกรายรับ, กันภาษี, สแกนสลิป), the รอเงินเข้า and โหลภาษี cards, and the รายได้แยกตามแหล่ง block. Compact NetWorthHero and HomeYearSection stay. Slip scan stays in the capture / voice flow. No schema, RLS, auth, billing, or formula changes. Next: owner 390px check on device.

- SLIP-KPLUS-OCR — Owner: Grok Bot; IN PR → staging. Rebased onto staging after Home Variant B, the monthly-spend card removal, and Finance Variant B. On-device slip review was showing ฿0 because K PLUS prints `จำนวน:` (not `จำนวนเงิน`) and Tesseract reads `พ.ย.` as `พ.ุย.`/`พุย.`. Parser now accepts that layout, PSM 4 keeps the QR out of the text column, and gallery images are decoded on the main thread before OCR. The cream Home monthly-spend card stays removed. No schema, RLS, auth, billing, or money-formula changes. Next: owner re-upload of the 6 slips on an iPhone.

- FINANCE-VARIANT-B — Owner: Grok Bot; IN PR → staging. Finance → รายการ is the monthly close-up: green month hero (รับ/จ่าย/สุทธิ, budget only when one exists) and a full-month calendar (darker red = more spent, green = income day, day tap filters the list). Home Variant B untouched. The cream Home monthly-spend card stays removed. No schema, RLS, auth, billing, or formula changes. Next: owner 390px check on device.

- HOME-REMOVE-MONTH-CARD — Owner: Grok Bot; merged to staging (#63). Removed the cream Home monthly-spend card (`MonthlySpend`, `src/features/dashboard/components/monthly-spend.tsx`). Compact `NetWorthHero` and Variant B `HomeYearSection` stay. Slip `MonthlySpendCard` / `MonthlySpendDetail`, finance-tab calendar, and year summary stay. No schema, RLS, auth, billing, or formula changes.

- HOME-VARIANT-B — Owner: Grok Bot; IN PR → staging. Home opens with the Variant B notebook year overview: compact green net worth, Buddhist year switcher (current and two previous), selected full year vs previous full year, category comparison with อื่นๆ after 8 rows, and goals whose target date falls in that year. No schema, RLS, auth, billing, or formula changes. Next: owner visual check on device.

- SLIP-POLISH — Owner: Codex; READY FOR HANDOFF. Optimistic undo + retry snapshot and explicit fuel keywords implemented. Node 22 NLP precision=1 / zero critical; tsc (after next typegen), lint and 64 focused tests PASS. Full Vitest: 167 files / 2469 tests PASS; one offline-assets test blocked by spawnSync EPERM. Supervisor reviews/commits; no DB/auth/RLS/billing/formula changes or commit/push.

- W5-SWITCH-SIZE — Owner: Codex; DONE. Scope: SettingsSwitch minimum-size utilities and CaptureLargeTextToggle native label row. Requested tsc and component Vitest PASS (17 tests); no commit.

- W5-FOLLOWUPS — Owner: Codex; DONE. Scope: shared Profile AI/large-text switch, pure unsure-question wording and focused tests. Completed: reused switch → pure wording from parsed draft → typecheck and 58 targeted tests PASS; no DB/formula/auth/RLS or commits.

- QA4-MONEY-TEXT — Owner: Codex; READY FOR HANDOFF. Server calendar/date text snapshot + shared profile-timezone day implemented. Node 22 typecheck/lint/full Vitest PASS (154 files / 2168 tests); exact production WebKit differing string unconfirmed: sandbox IPC EPERM prevents browser launch. Owner production WebKit retest; no build/dev/start or DB/auth/formula changes.

- VOICE-PAPER-TAP2 — Owner: Codex; READY FOR HANDOFF. Native growing textarea + synchronous non-passive touchend fallback and transparent focus styling complete. Node 22 typecheck/lint pass; full Vitest 148 files / 2141 tests pass. Local harness remains unstaged; server/browser sandbox EPERM blocks visual run. Supervisor handles real iPhone acceptance/push/PR.

- CAPTURE-SAVE-VISIBLE — Owner: Codex; READY FOR HANDOFF. Supervisor follow-up complete: restored original 92dvh cap; reveal scrolls down only; four pure tests updated. Node 22 typecheck/lint PASS; full Vitest 149 files / 2134 tests PASS. Supervisor verified review-first/Save visibility at 390×664 + 34px safe area. No git operations; supervisor owns commit.

- THAI-CAPTURE-FIXES — Owner: Codex; READY FOR HANDOFF. Capture-only fixes and 30 corpus additions complete; full Node 22 suite 148 files / 2113 tests, NLP criticalFailures=[] and autoSavePrecision=1, tsc and ESLint pass. Original 320-case baseline and labels preserved. No UI/schema/auth/formula changes or commits. Owner: review local diff.

- COVER-BACKFACE — Owner: Codex + Grok Bot; PR to staging. Added swipe-only ruled page, two-sided cover, angle shading and rAF release tween; static launch branch preserved. Vitest 9/9, tsc (after next typegen), focused ESLint and diff check pass. No commit/push/env changes. Next: owner iPhone review.
- INVOICE-UI — Owner: Codex; READY FOR HANDOFF — second WebKit fixes complete: shared ThaiDateField in form/payment with max=today retained; explicit z-60 backdrop/z-61 popup above z-30 bottom nav, mobile safe-area bottom sheet and centered sm+ dialog; success status is sr-only aria-live while toast and visible selectable clipboard fallback remain. Node 22: requested full Vitest 147 files / 2070 tests, tsc, eslint src tests and diff check pass. No commit/push or edits to dev-harness, middleware or .env.local. Next: owner repeat 390px WebKit visual/picker review.

- INFRA-SIN1-STAGING — Owner: Codex; READY FOR HANDOFF. Minimal region/allow-list/tests/README edits complete. Focused Vitest: 2 files / 37 tests passed with --configLoader runner (default loader blocked by read-only node_modules). Requested tsc failed: existing missing LayoutProps in src/app/layout.tsx:93. No env/secrets, commit or push.

- SAFE-TO-SPEND-APPROVED — Owner: Codex; READY FOR HANDOFF to supervisor; user approved on 2026-10-19 at 21:14 Asia/Bangkok (PR #31). Approval-only update in the five requested files; no calculation changes. Focused tests 34/34, typecheck, ESLint (Markdown ignored), full suite 139 files / 1928 tests and diff check passed. Changes uncommitted; supervisor handles commit/push/PR.

อัปเดตตารางนี้ทุกครั้งที่รับหรือส่งต่องาน เก็บเฉพาะงานที่กำลังทำและงานถัดไปใกล้ที่สุด

| ID | งาน | Owner | Status | Scope / Deliverable | Next handoff |
|---|---|---|---|---|---|
| FINANCE-VARIANT-B | Finance รายการ redesign Variant B (month close-up) | Grok Bot | IN PR → staging | Green month hero + full calendar with per-day net. Day tap keeps the existing from/to filter. Home B untouched. Cream Home monthly-spend card stays removed. Display only. | Owner 390px check; merge to staging only |
| HOME-REMOVE-MONTH-CARD | Remove cream Home monthly-spend card | Grok Bot | merged (#63) | Deleted Home-only `MonthlySpend` shell. Keep compact net worth + Variant B year overview. Slip card/detail stay. | — |
| HOME-VARIANT-B | Home redesign Variant B (year overview) | Grok Bot | IN PR → staging | Compact net worth, year switcher 2569/2568/2567, income/expense/ออมได้, category compare, goals due that year. Display aggregation only. | Owner 390px check; merge to staging only |
| QA4-FOLLOWUPS | PR #51 blob clearance + Thai weekday | Codex | DONE — local review | Emergency form mobile gutter + route docking (restored/resized/dragged); UTC Thai abbreviations. Typecheck/lint and 3 Vitest files / 25 tests pass. No DB/auth/billing/formulas or commits | Owner 390×664 device review |
| INVOICE-QA-FIXES | Bugs 5/6/7a/7b; invoice logic only | Codex | READY FOR HANDOFF | 5/6/7a implemented; 7b not reproduced (existing profile-zone and SQL-date paths correct), regressions added. Node 22 typecheck/lint; full 151 files / 2148 tests; UTC 3 files / 14 tests pass. No UI/DB-write/schema changes. | Supervisor stages/commits (Git metadata read-only), reviews/pushes/PR; affected date example needed |
| THAI-CAPTURE-REVIEW | Review staged Thai parser regressions | Codex | DONE | Four blocking classes fixed; Node 22 full Vitest 148 files / 2130 tests, eval safety, tsc and eslint pass | Owner local review; unstaged fixes, no commit |
| COVER-SWIPE-OPEN | Closed cover pointer swipe | Codex | DONE | Pointer capture + rAF face rotation, release/flick/spring, tap/keyboard, reduced motion and locale copy. Targeted 27 tests; full 143 files / 1996 tests, typecheck and lint pass on Node 22. | Owner device review |
| SMART-CAPTURE-BLOCKING-REVIEW | Strict money/security/retry review | Codex | DONE | Reviewed diff; fixed partial retry principal/down-payment recovery and invalid-rate save routing; 140 files / 1963 tests, typecheck and full lint pass | Owner local review; no DB/commit/push |
| SMART-CAPTURE-COLUMNS | 0048 columns, loan transfers, principal repayment, rate override | Codex | DONE — local review | Dedicated columns + legacy fallback/recovery; deterministic loan ledger transfers; owned recurring links; principal balance updates and paid summing; shared rate UI. Node 22: 140 files / 1960 tests, typecheck, changed TS/TSX lint pass. | Owner review; no commit/push/DB |
| NLP-PHASE1 | Confidence gate + synthetic corpus + evaluation (logic only) | Codex | READY FOR HANDOFF — required checks pass | Pure gate, additive draft adapter, 320 synthetic labels + measured per-slice baseline; no UI/save/schema/formula changes | Supervisor review/commit; changes uncommitted |
| SMART-ASSETS-LOANS | Smart capture assets/installments/loans and asset valuation | Codex | IN PR → staging | New pure taxonomy/valuation/purchase modules, authenticated save action, minimal capture fields, tests, proposal SQL only. Checkpoints: pure logic → persistence → UI → full validation. Shared parser/UI edits surgical; no network/DB/commit/push. | Claude designs confirm screens later; proposal 0048 needs user approval |
| VOICE-PAPER-TAP | Tap blank voice paper → keyboard on iPhone | Grok Bot | IN PR → staging (fix of #34) | Focus moved from pointerdown to the paper's click (sync, no preventDefault) — #34's pointerdown focus was blurred by the tap's mousedown; shared `focusPaperEnd`; Vitest guard + `tests/e2e/voice-paper-tap-live.spec.ts` | Owner iPhone Safari PWA keyboard check |
| PAGE-TURN-SNAPSHOT | Turn-start cost + one continuous sheet | Grok Bot (Codex impl) | IN PR → staging | Viewport-only clone (`src/lib/motion/viewport-clone.ts`), single clone reused for history, sheet covers whole visible main incl. title + tab strip (`sheetGeometry`); harness 4× CPU longtask median ~144ms → ~79ms | Owner device check of turn feel |
| HOME-RECEIVABLES-TILE | Home รอเงินเข้า tile uses getReceivablesSummary | Grok Bot (Codex impl) | IN PR → staging (#32) | Amount + count + calm overdue line; exact empty state on none/error/loading | Claude may restyle after 22:00 |
| SAFE-TO-SPEND-TODAY | Add isolated today calculation, server loader, tests and assumptions docs | Codex | READY FOR HANDOFF | Logic only; legacy formulas/Home unchanged; branch codex/safe-to-spend-today; no commit/push; typecheck/lint/131 files · 1731 tests passed | Supervisor review and commit |
| HOME-TRIM-CARDS | Remove unused Home cards (cushion, next-action, savings-rate insight, month summary, goals, mission/level, more-insights expander); keep greeting/NW/quick actions/upcoming tiles/up-next/income-by-source; trim unused Home fetching; update tests | Grok Bot (Codex impl) | IN PR → staging | Home render-only trim + `hasAnyDashboardData`; component files kept; tests in `tests/home-trim-dashboard.test.ts` | Merge after CI green; 390px shot under /workspace/home-trim/shots/ |
| TAB-STRIP-STILL | Keep section strips outside content turns | Codex | DONE — Node 22 lint/typecheck/1461 tests passed | Curl geometry/snapshot alignment, horizontal strip helper + tests; preserve prior fixes, no git/harness/deps | Implement, run Node 22 lint/tsc/full Vitest, owner device review |
| CURL-CONTENT-READY | iOS turn landing and raster cost | Codex | DONE — Node 22 lint/typecheck/1456 tests passed | Shared curl lifecycle, CSS, section marker, Node tests; preserve gesture fix; no git/harness/deps | Implement bounded readiness, validate lint/tsc/full Vitest, owner device review |
| TOUCH-CURL-RECOVERY | Detached touch target and settling sheet cleanup | Codex | DONE — lint/typecheck/122 files · 1451 tests passed | SwipeTabPages, motion helper, Node regression tests, this board; harness unchanged; no git commands | Owner device review |
| CAPTURE-SUB-REFINEMENTS | Recurring bill categories, cancellation refund guard, subscription account boundaries | Codex | DONE — typegen/typecheck, all changed TS/TSX ESLint, full Vitest 123 files / 1590 tests pass | keywords.ts, subscription-intent.ts, transaction-parser.ts, two capture tests and this board; existing uncommitted work preserved; no commit/push or schema/RLS/migrations | Local owner review |
| CAPTURE-SUBSCRIPTIONS | Subscription capture + recurring confirm + cancellation | Codex | DONE — typegen/typecheck, changed TS lint and full Vitest 123 files / 1507 tests passed | Capture parser/actions/UI, recurring shared insert and cancellation guards, upcoming bills, locales, seven test files and status docs; no migrations/schema/RLS/production/commit/push | Local review by owner |
| HOME-SCAN-SLIP | Home quick action "สแกนสลิป" opens slip scan (file input) directly, not Quick Capture sheet | Grok Bot (Codex impl) | IN PR → staging | Home scan → synchronously clicked mounted picker → existing QuickCaptureSheet image handler; no layout/parser changes. Focused tests/lint/typecheck passed | Merge after CI green |
| INVOICE-TAXJAR-ACTIONS | Invoice and tax jar server data/actions | Codex | DONE — 75 new tests; lint/typecheck/full Vitest passed | Authenticated actions/loaders, types, Zod validation, TH/EN errors; no UI/migrations/formula edits. API + save consistency limits in src/features/invoices/README.md | Owner commit; UI agent integration |
| CAPTURE-EMERGENCY | Emergency source intent and food classification | Codex | DONE — all requested checks passed on Node 22 | Parser + AI preservation, read-only linked account wiring, regression tests; no UI/DB changes | PR to staging |
| RESUME-PILL-NAV | Mobile resume pill safe-area clearance | Codex | DONE | Host class/comment + focused rendering regression; inspect nav geometry, run typecheck/lint/related Vitest | PR to staging (screenshots 390px ± 34px safe area) |
| SLIP-PARSE-MATCH | Portable Thai e-slip parser and matcher | Codex | VERIFY — typecheck/lint and 113 files / 1302 tests passed | src/lib/slip + synthetic tests; implement, validate, PR and merge into staging after checks | Codex → staging reviewers; report /workspace/reports/slip-parse-match-pr.md |
| PDF-IMPORT-REVIEW | Full PR #6 diff vs origin/staging; parser/security fixes and required checks | Codex | DONE — no blocking findings remain; typecheck/lint/108 files·1167 tests passed | Non-UI PDF engine/extraction + regression tests; Claude UI untouched | Grok/Claude review unstaged fixes; no commit/push |
| STAGING-SEC-E2E | Staging DB hardening and live-test target guard | Codex | READY FOR HANDOFF — local checks passed | Migration 0046, shared guard, demo/live specs; validate typecheck/lint/full Vitest, PR into staging, merge after all checks pass | Supervisor applies DB separately; report /workspace/reports/staging-sec-e2e-pr.md |
| RECURRING-CONFIRM-ICON | Recurring card round confirm control | Codex | DONE | Card round icon, native tooltip, pending spinner, replayable reduced-motion-safe bounce; focused render coverage. Typegen/typecheck, TS lint, 21 related tests pass (runner loader); CSS ignored by ESLint config | PR to staging (390px before/after shots) |
| MONEY-IMPORT-TESTS | Money/import unit coverage | Codex | DONE — tests and local validation | Tests only in money/import suites; no production changes. Plan: verify gaps, add boundary tests, typecheck/lint/full Vitest, PR into staging and merge only if all checks pass | Codex → staging reviewers; report /workspace/reports/money-import-tests-pr.md |
| ANIMATED-RM-01 | AnimatedNumber reduced-motion hydration | Codex | DONE — implementation and local validation | Logic-only component fix and regression tests; typecheck/lint and 104 files / 1036 tests passed | PR #8 into staging; merge gated on all checks; final outcome in /workspace/reports/animated-number-pr.md |
| LOGIC-HOME-01 | Home MoM baseline + timezone month card | Codex | READY FOR HANDOFF — commit blocked by read-only Git metadata | Pure calendar/snapshot helpers, dashboard logic and unit tests; no formula/UI/DB changes | Parent stage/commit in writable Git environment |
| PDF-IMPORT-UI | PR #6 PDF statement import — upload-step UI | Claude (UI) · Codex (logic/security review) | READY FOR REVIEW — typecheck/lint/108 files·1155 tests ผ่าน; ยังไม่ commit | UI-only ใน `statement-import-flow.tsx` (+ selector ใน e2e spec): mobile-first 390px, Thai-first copy, password field แสดงเมื่อเป็น PDF, privacy note สั้น, PDF notice callout, error ตาม locale; ไม่แตะ actions/parser/pdf-extract/DB | Codex review logic หลัง UI เสร็จ |
| HOME-V3-C | Home redesign to mockup variant C (freelancer dashboard) | Claude (UI) | IN PR → staging — Codex reviewed; typecheck/lint/115 files·1312 tests passed | Branch `claude/home-variant-c`: dark NW hero + sparkline, quick actions (income/scan → shell Quick Add via `quick-add-request.ts`; invoice/tax = "เร็ว ๆ นี้"), invoices/tax-jar coming-soon tiles, income-by-source list, cushion/safe-to-spend tiles from existing calcs; no formula/DB changes. `src/app/dev-harness/` is a local harness — do not commit | Owner review on device; live check with real data |
| ART-01 | Brand & Marketing templates | Claude | TODO | จัด Feature Announcement, Product Preview และ Social Share จาก master ที่อนุมัติแล้ว | ส่งภาพหน้าจอ/ผล QA ให้ Codex ตรวจความสม่ำเสมอ |
| QA-01 | Empty State live QA | Claude | TODO | ตรวจ Notifications และ Forecast ด้วยสถานะจริง | บันทึก viewport, theme และผลตรวจใน `ARTWORK_ROADMAP.md` |
| ART-02 | Brand artwork visual QA | Codex | WAITING | ตรวจ light/dark, mobile/desktop และ social safe area หลังติดตั้ง | รอ Claude ส่งหน้าจอจริง |
| AUTO-INFRA-01 | Fresh-clone typecheck | Grok | DONE — PR #1 merged (`7f62e87`) | `npm run typecheck` = `next typegen && tsc --noEmit` (ไม่มี script `typegen` แยก ตามที่เจ้าของโปรเจกต์ตัดสิน) ผ่านบน Node 22/24 จาก `.next` ว่าง; Codex review = APPROVE (https://github.com/techhealthhero-cmd/Wealth-OS/pull/1) | — |
| AUTO-INFRA-02 | Pin Node 22+ | Grok | DONE — PR #1 merged (`7f62e87`) | `.nvmrc`=22, `engines.node >=22`, README Node 22+; `npm ci` ไม่มี EBADENGINE บน Node 22.23.3 และ 24.22.0 | — |
| AUTO-INFRA-03 | Safe bot build profile | Claude | TODO | Build โดยไม่ใช้ production secrets/network writes | Codex security review ก่อน Grok ใช้ |
| AUTO-SEC-01 | npm audit triage | Claude (tracking: Grok) | ESCALATED | รายงานเสร็จ (Claude Code ร่าง, Grok ตรวจ) บน branch local `claude/auto-sec-01-audit-triage`; เข้า stop condition จึงยังไม่ push; ไม่มีการเปลี่ยน dependency/lockfile | เจ้าของโปรเจกต์ตัดสินใจจากรายงานที่ส่งตรงให้ |
| REVIEW-HOME-V3-A | Re-review income by source fixes | Codex | DONE — NO BLOCKING FINDINGS | Added 3 mocked loader regressions; lint, 1137 tests and typecheck pass; no production edits | Claude visual QA at 390px and dark mode; owner review |
| UI-HOME-FREELANCER-A | Home redesign "A — รายได้แยกตามแหล่ง" (ฟรีแลนซ์) | Claude (impl) | VERIFY — PR #11 (`claude/home-freelancer-a` → staging), visual QA 390/375 light/dark ผ่าน, harness ชั่วคราวถูกลบแล้ว | การ์ดรายได้เดือนนี้แยกตามแหล่ง (loader อ่านอย่างเดียว + aggregation display-only `src/features/dashboard/lib/income-by-source.ts` + tests) และการ์ดมูลค่าสุทธิแบบย่อ; ตัดการ์ด "รอเงินเข้า" ออกเพราะยังไม่มีระบบใบแจ้งหนี้; ไม่แตะสูตร/DB/auth. รอบแก้ review Codex (2026-10-19): today ตาม timezone โปรไฟล์, trackingStartMonth จากธุรกรรมแรก, paging 1000/batch 200 (`lib/paged-fetch.ts`), concentration > 50%, layout ตาราง/highlight/net worth ย่อ; typecheck/lint/1137 tests/build ผ่าน | Grok merge เมื่อ checks ผ่าน |
| UI-HOME-A | Home redesign variant A (สะอาด ชัดเจน) | Claude (impl) · Codex (review) · Grok (orchestration) | VERIFY — PR open | UI-only บน `claude/home-redesign-a`: header วันที่+ทักทาย, NetWorthHeroCard (ทศนิยมเล็ก, pill เปลี่ยนแปลง, เดือนใต้กราฟ, ปุ่มไป /money/net-worth), การ์ดเดือน (หัวข้อชื่อเดือน+เหลืออีก N วัน, แถบรายรับ/รายจ่ายพร้อม hatch, tile รายรับ/รายจ่าย); ไม่แตะสูตร/DB/auth | เจ้าของโปรเจกต์ตรวจ Preview แล้วตัดสินใจ merge |
| UI-MONEY-FLIP | การ์ดสินทรัพย์/หนี้สินแตะเพื่อพลิก (ใช้ระบบเดียวกับบัญชี) | Claude (UI) | READY FOR REVIEW — tsc/lint/110 files·1202 tests ผ่าน; ยังไม่ได้ตรวจด้วยตาในเบราว์เซอร์ | UI-only: `src/lib/closed-cards-store.ts` + `src/components/shared/flip-card.tsx` (ปุ่ม toggle สำหรับคีย์บอร์ด), refactor AccountCard, ด้านหลังการ์ดสินทรัพย์/หนี้สินไม่มีตัวเลขเงิน; ไม่แตะ lib/financial, queries, actions, DB, account-privacy; ยังไม่ commit | เจ้าของโปรเจกต์ตรวจ |
| AUTO-CLEAN-01 | Unused eslint-disable ใน `opengraph-image.tsx` | Grok | DONE — PR #1 merged (`7f62e87`) | ลบคอมเมนต์ที่ไม่ได้ใช้; lint 0 problems | — |

## Current Shared Context

- ภาพหลักตาม Artwork Roadmap วาดครบแล้ว
- Brand & Marketing มี master พื้นหลังโปร่งใส 5 ไฟล์ใน
  `assets/artwork/masters/brand-marketing/`
- เจ้าของโปรเจกต์ต้องการให้ Claude เป็นผู้ติดตั้งและจัดองค์ประกอบภาพในแอป
- ภาษาภาพหลักคือ gouache + ink ที่อบอุ่น สะอาด และไม่สัญญาความร่ำรวยเกินจริง
- งานที่ยังค้างเป็นการทำ template/ติดตั้งและ visual QA มากกว่าการวาดหัวข้อใหม่
- `ARTWORK_ROADMAP.md` เป็นแหล่งสถานะรายละเอียดของงานภาพ
- `PROJECT_STATUS.md` เป็นแหล่งสถานะภาพรวมของผลิตภัณฑ์
- `FOUNDER_NOTES.md` เก็บบทเรียนและหลักคิดของเจ้าของโปรเจกต์ที่ควรใช้ประกอบการตัดสินใจ
- `GROK_BOT_ONBOARDING.md` เป็นคู่มือเริ่มต้นและ safety boundary สำหรับ automation กะกลางคืน

## Decisions

บันทึกเฉพาะการตัดสินใจที่อีกฝ่ายจำเป็นต้องรู้ ใช้รูปแบบ:
`YYYY-MM-DD — ผู้ตัดสินใจ — การตัดสินใจ — เหตุผล/ผลกระทบ`

- 2026-10-18 — เจ้าของโปรเจกต์ — ให้ Codex เน้นสร้าง artwork และให้ Claude ติดตั้ง/จัดหน้า — ใช้จุดแข็งของแต่ละฝ่ายและลดงานซ้ำ
- 2026-10-18 — Codex + Claude workflow — ใช้ไฟล์นี้เป็น collaboration board กลาง — เพื่อให้รับช่วงงานได้โดยไม่ต้องให้เจ้าของโปรเจกต์เล่าบริบทซ้ำ
- 2026-10-18 — เจ้าของโปรเจกต์ — ให้ Codex ดูแล token budget และให้ทุก agent ทำงานจากแผนที่กลับมาต่อได้ — รักษาคุณภาพพร้อมลดการอ่านและทำงานซ้ำ
- 2026-10-18 — เจ้าของโปรเจกต์ — เพิ่ม Grok Bot เป็น automation/night-shift operator — ตั้งใจให้ช่วยดูแลงานต่อเนื่องระหว่างที่เจ้าของโปรเจกต์พัก โดยต้องใช้คิวที่อนุมัติและ review gate
- 2026-10-19 — เจ้าของโปรเจกต์ — ใช้ PR #1 ของ Grok สำหรับ AUTO-INFRA-01/02 และ AUTO-CLEAN-01; งานซ้ำของ Claude ที่อยู่ในเครื่อง (ยังไม่ commit) ถือว่า superseded — ป้องกันงานซ้ำ/ชนกัน
- 2026-10-19 — เจ้าของโปรเจกต์ — อนุมัติให้ Grok Bot push branch และเปิด PR ได้ (ห้าม merge, deploy, แตะ production/secrets/migrations/RLS/billing/financial formulas, เปลี่ยน dependency/lockfile หรือรัน E2E) — merge ยังเป็นอำนาจเจ้าของโปรเจกต์เท่านั้น
- 2026-10-19 — เจ้าของโปรเจกต์ — ไม่เพิ่ม script `typegen` แยก; ใช้ `npm run typecheck` คำสั่งเดียว

## Blockers / Questions

- ยังต้องกำหนด production ratios และ safe area ของแต่ละ Brand & Marketing channel
- Empty State ของ Notifications และ Forecast ยังไม่มีผล visual QA จากสถานะจริง

## Handoff Log

### 2026-10-26 — Grok Bot → owner (HOME-REMOVE-SHORTCUTS-INCOME)

- Removed from signed-in Home: the four shortcut circles, the รอเงินเข้า / โหลภาษี cards, and the income-by-source section. Deleted the Home-only components (`home-quick-actions`, `home-expected-tile`, `HomeExpectedTileCard`, `HomeTaxTile`, `soon-chip`, `income-this-month` and its card) and the Home-only `getIncomeBySourceData` loader. The pure grouping helpers in `income-by-source.ts` stay tested but Home does not call them. Compact green net worth and Variant B `HomeYearSection` stay. Finance calendar untouched. Slip scan remains in Quick Capture and the voice notebook. Invoice and tax-jar features themselves are unchanged. No schema, RLS, auth, billing, or formula changes. No signed-in 390px screenshot: this environment has no Supabase session.

### 2026-10-26 — Grok Bot → owner (HOME-REMOVE-MONTH-CARD)

- Removed the cream Home monthly-spend card: `MonthlySpend` (`src/features/dashboard/components/monthly-spend.tsx`) is gone from `src/app/(app)/dashboard/page.tsx`, and that Home-only shell file is deleted because nothing else imported it. Compact green `NetWorthHero` and Variant B `HomeYearSection` stay. `getMonthlySpendSummary` still feeds the green card's month-spent line. Slip capture still uses `MonthlySpendDetail`; the slip preview still renders `MonthlySpendCard`. No schema, RLS, auth, billing, or formula changes. Finance-tab calendar and year summary untouched.

### 2026-10-19 — Codex → owner (INFRA-SIN1-STAGING)

- Changed staging functions to sin1; exact-host Set accepts Singapore and rollback Tokyo staging. Existing safety checks/messages and rejection cases retained; added both requested Singapore spoof rejections. README documents production icn1 until functions/DB move together.
- Validation: requested Vitest startup blocked by read-only node_modules; rerun with --configLoader runner passed (2 files / 37 tests). Requested `npx tsc --noEmit -p .` failed with TS2304, missing LayoutProps at src/app/layout.tsx:93; unrelated source left unchanged. Diff check passed; vercel.json verified byte-identical except region replacement.
- Changes uncommitted on infra/sin1-staging; no push, env/secrets edits or deployment. Next: owner review; generated Next.js types needed for a clean typecheck.

### 2026-10-19 — Codex → supervisor (NLP-PHASE1)

- Completed first slice in `/tmp/wos-nlp1`, branch `codex/nlp-phase1-confidence-gate`: field evidence/reasons + deterministic single question, additive emergency/gate draft adapter, exported amount/emergency candidates preserving legacy parser outputs, pure evaluator, 320 synthetic labelled cases (30 per priority slice), baseline regression assertions and `npm run nlp:eval`.
- Required checks under the requested Node 22 PATH: typecheck PASS; changed-code ESLint PASS (zero warnings); full `npx vitest run --configLoader runner` PASS (141 files / 1956 tests); `npm run nlp:eval` PASS; diff check PASS. No tests skipped/disabled and no dependencies added.
- Baseline: precision 100% (124/124), coverage 38.75%, clarification 61.25%, uncertainty recall 100% (190/190), zero critical failures; raw exact match 41.875%. Category labels cover 276 cases; raw category accuracy 89.1304%. Six income misreads and 30 service-name category false positives remain explicit legacy limitations; the gate blocks unsafe automation. Detailed metrics/limits in `src/lib/capture/CONFIDENCE.md` and baseline fixture.
- UI constructors, automatic/manual/server save behavior, AI orchestration, financial formulas and schema remain untouched. Follow-ups: completion + undo UI wiring, local-only capture orchestration, device outbox/storage, speech, independent corpus growth. Any schema/migration/server storage work is NEEDS USER APPROVAL.
- Changes remain uncommitted; no push or PR. Next action: supervisor review the diff and the documented caller integration contract before committing this slice to staging.


### 2026-10-19 — Codex → supervisor (SAFE-TO-SPEND-TODAY)

- Completed isolated pure integer-satang calculation, server-only loader, pending-approval assumptions README, 34 focused tests, and additive tax-settings configured flag with existing-loader regression assertions.
- Scope: src/lib/financial/safe-to-spend-today.ts; src/features/safe-to-spend/{today.ts,README.md}; src/features/tax-jar/queries.ts; tests/safe-to-spend-today*.test.ts; tests/invoices-tax-jar-actions.test.ts; this board.
- Node 22 checks passed: npm run typecheck; ESLint all changed TS files; npx vitest run --configLoader runner (131 files / 1731 tests). Protected legacy financial modules and getSafeToSpend queries have no diff.
- Formula and tax/emergency assumptions remain pending_user_approval. No UI/Home, migrations, auth/RLS, production data, DB writes, commits, pushes or PRs. Branch codex/safe-to-spend-today starts at 7aa2c18.
- Next: supervisor review and commit the uncommitted patch; no implementation work remains.


### HOME-TRIM-CARDS (2026-10-19 Asia/Bangkok)
- Removed Home-only cards: HomeCushion, NextBestAction/InsightCards, MonthlyDonutCard, GoalProgressCard, EngagementSummaryCard, DashboardDetailsToggle (+ children).
- Kept greeting, NetWorthHero, HomeQuickActions, DailyInboxSection, HomeUpcomingTiles, UpNextPayments, IncomeThisMonth.
- Replaced getDashboardData on Home with hasAnyDashboardData (accounts OR 1-row month tx probe).
- Component files left intact for other surfaces.

### 2026-10-19 — Codex → local owner (CAPTURE-SUB-REFINEMENTS)

- Cadence-only bills retain recurring metadata, generic keyword categories and normal account/merchant suggestions. Signup or a known subscription service still selects subscription defaults; learned category preferences remain first. Cadence with no available keyword category retains subscription defaults.
- Shared service list in keywords.ts covers the requested brands; added ผ่อนรถ to Transport. Cancellation commands with an amount require subscription wording or a known service; เลิกสมัคร always cancels. Subscription accounts use Latin word boundaries while retaining Thai substring matches.
- Files: src/lib/capture/{keywords,subscription-intent,transaction-parser}.ts, tests/capture-{parser,subscription-intent}.test.ts and this board. Added 83 regression cases, including refund amounts, all requested services/signup markers and account name/purpose boundaries.
- Validation on installed Node 22.23.3: focused tests 200/200 pass; npx next typegen && npx tsc --noEmit PASS; ESLint across all 25 changed/new TS/TSX files PASS; full npx vitest run --configLoader runner PASS (123 files / 1590 tests); git diff --check PASS.
- Existing uncommitted subscription work preserved. No database calls, migrations/schema/RLS changes, commits or pushes. Next: local owner review.

### 2026-10-19 — Codex → local owner (CAPTURE-SUBSCRIPTIONS)

- Completed both subscription capture and voice/text cancellation in this copy. Pure rules extract service/cadence, use the existing สมาชิก/Subscription category, preserve learned categories and named/merchant accounts, then prefer active subscription-purpose accounts. Unresolved subscription accounts require a choice; unchosen defaults do not contribute voice low-balance warnings. Tuition/job applications without an explicit cadence remain ordinary expenses.
- Shared server-only recurring insert helper reuses buildRecurringTransactionSchema for manual and capture creation. Capture payments remain saved if scheduling fails; the result/toast reports that failure. Next due date advances from the paid date using calculateNextDueDate. User-scoped ILIKE dedupe plus deterministic capture schedule PK handles repeated/concurrent capture confirms. A retry does not resurrect a cancelled schedule; a newly confirmed signup can reuse its inactive capture schedule. Retry recovery uses persisted payment fields.
- Cancellation uses active user-scoped matching, explicit single/multiple confirmation cards, and existing is_active/end_date columns only. End dates clamp to start_date for future schedules. Past payments stay intact; stale recurring confirmation is rejected after cancellation. Upcoming bills now also excludes due dates beyond end_date. Existing payment calendar projects the next monthly/yearly dates and omits inactive/ended future items.
- Files: capture parser/draft/AI/recap/schema/actions + all preview entry points and two shared subscription components; recurring insert/actions/queries; upcoming-bills; th/en locales; seven unit/render test files; PROJECT_STATUS.md and this board.
- Final checks on installed Node 22.23.3: npx next typegen && npx tsc --noEmit PASS; npx eslint on every changed/new TS/TSX file PASS; npx vitest run --configLoader runner PASS (123 files, 1507 tests); git diff --check PASS. Browser/device QA was not run. No real database calls, migrations, schema/RLS edits, commits or pushes. Nothing requires a migration.
- Next: local owner reviews the patch; no publication performed.
### 2026-10-19 — Codex → owner (HOME-SCAN-SLIP)

- Home scanSlip requests `scan`; shell keeps its camera/file input mounted and clicks synchronously in the request handler for iOS user activation. Canceling leaves the sheet closed; choosing a file opens Quick Capture and consumes it once via existing handleImage/scanReceipt.
- Scope: quick-add-request, home-quick-actions (behavior/comment only), quick-add, QuickCaptureSheet optional initial image props, and request unit tests. Capture/income/voice paths retained; no layout/CSS, parser, actions, subscriptions, or DB changes.
- Validation: required request suite passed (14 tests); request + existing receipt/draft suites passed (32 tests); ESLint on all touched code/tests and git diff --check passed; next typegen + tsc --noEmit passed. Initial bare tsc required generated LayoutProps, resolved by next typegen. No physical iOS Safari validation performed.
- Status: Grok Bot committing from writable shell after Codex sandbox blocked `.git/index.lock`; opening PR to staging and merging only if checks pass.

### 2026-10-19 — Codex → owner / invoice-tax-jar UI agent (INVOICE-TAXJAR-ACTIONS)

- Added invoice create/update/send/void/mark-paid actions, next-number pure helper, sent receivables loader, tax jar settings/append-only ledger actions and paginated summary loaders. All authenticate; session ownership filters and existing DB triggers/RLS retained. Added four handwritten table types, payment RPC type and invoice transaction source, shared Zod validation and matching TH/EN errors.
- Invoice/line totals recomputed server-side using existing financial helpers; decimal baht boundary conversion. Income uses RPC only, net cash is tax-jar base (฿10,670 × 7% → 74,690 satang). Duplicate source set-asides return existing id. Default settings only when no row, never on read failure.
- Tests: 75 new mocked/pure cases cover validation, ignored client totals, immutable paid/void status, optimistic update conflicts/cleanup, RPC mapping/idempotent pass-through, profile-timezone dates, defaults, duplicate ledger entries, balances, pagination, ownership/auth and receivables. All requested commands on Node 22 pass: npm run lint; npm run typecheck; npx vitest run (122 files / 1,522 tests). No live DB/network tests, commit or push.
- UI integration API and input fields: `src/features/invoices/README.md`. Payment success survives a failed post-commit suggestion read (`setAsideSuggestion: null`, `suggestionError`); retry is safe. Mode auto still returns a suggestion; allocation requires explicit addTaxJarEntry call with sourceTransactionId.
- Material limit: 0047 has no transactional invoice+items save RPC. Saves use staged items, optimistic header version/status guards and checked best-effort cleanup/restore; process interruption/intermediate reads and concurrent payment cannot be made fully atomic without a future save RPC. Documented in README; no migration changes made.
- Scope preserved: no existing React components/pages, .env files, generated reference types, financial formulas, RLS/auth rules, migrations or main/production config changed. Next: owner reviews/commits; UI agent consumes exported APIs and handles loader errors before empty states.


### 2026-10-19 — Codex → owner: RESUME-PILL-NAV

- Completed: resume pill uses pages' existing `7rem + env(safe-area-inset-bottom)` clearance; desktop `md:bottom-6` retained. Replaced stale floating QuickAdd FAB comment with current nav-center mic reference.
- Geometry at default sizing: item 20px icon + 2px gap + 16.5px label + 12px padding = 50.5px; nav padding adds 12px = 62.5px; wrapper adds 16px + safe area = 78.5px + inset. Raised mic reaches 93.5px + inset; 112px + inset offset leaves 18.5px gap.
- Files: `src/components/shared/minimizable-form-context.tsx`, `tests/minimizable-form-context.test.ts`, this collaboration board. Two server-rendered regressions cover minimized and minimizing states.
- Validation: initial `npx tsc --noEmit -p .` lacked generated LayoutProps; `npx next typegen` then `npx tsc --noEmit -p .` passed. ESLint on both changed code/test files passed. Default Vitest config loader hit read-only node_modules/.vite-temp; rerun `npx vitest run tests/minimizable-form-context.test.ts tests/nav-notch-path.test.ts --configLoader runner` passed (2 files, 11 tests). `git diff --check` passed.
- Next: PR to staging with 390px before/after screenshots (simulated 34px iPhone safe-area). No migrations, auth/RLS or financial changes.
### 2026-10-19 — Codex → user (RECURRING-CONFIRM-ICON)

- Replaced recurring card text CTA with a right-side 40px primary check circle and expanded 44px hit area; action and due/active gating preserved.
- Added accessible label/native tooltip, pending spinner/aria-busy, and keyed 400ms icon bounce with reduced-motion override. No data/action/i18n changes.
- Checks: `npx next typegen && npx tsc --noEmit` passed; ESLint TS files passed (globals.css ignored by repository config); Vitest runner loader: 3 files, 21 tests passed. Default loader blocked by read-only node_modules temp directory.
- Visual: 390px before/after harness screenshots taken by supervisor; PR to staging.


### 2026-10-19 — Codex → staging reviewers (SLIP-PARSE-MATCH)

- Implemented portable label-based Thai/English e-slip parsing and deterministic transaction ranking in `src/lib/slip/`; exact integer satang via existing money helper, BE/CE dates, Bangkok timestamps, masked parties, 13 bank codes, confidence and reference extraction. No UI/DB/auth/migration/dependency changes.
- Added synthetic parser/matcher coverage; README documents API, options, matching/duplicate semantics and heuristic limits. No actual slip data retained or logged.
- Final validation: typecheck/lint passed; full Vitest 113 files / 1302 tests passed (93 new synthetic cases). Vitest uses `npm test -- --configLoader runner` because the default bundled config loader writes into read-only symlinked node_modules.
- Git worktree metadata is read-only (FETCH_HEAD/index.lock creation rejected). Publishing the same validated files from an isolated writable checkout under `/tmp/slip-parse-match-publish`; original worktree metadata and node_modules untouched.
- Next: commit/push `codex/slip-parse-match`, open PR into staging, merge only after all PR checks pass, record final outcome in `/workspace/reports/slip-parse-match-pr.md`.

### 2026-10-19 — Codex → Claude / Grok (REVIEW-HOME-V3-A)

- Re-reviewed uncommitted Home v3 A diff, including untracked paged-fetch.ts; no blocking logic findings. Verified timezone/calendar windows, tracking start, future transaction exclusion, exact-page termination, unique Earn link precedence, strict >50% concentration, locale key/placeholder parity, money formatting and server/client boundaries.
- Added tests/income-by-source-loader.test.ts: real loader with mocked Supabase checks 1001-row paging/order/range and 200-id batches without double counting, complete localized category fallback after a later Earn batch fails, and income read errors rejecting rather than displaying partial/zero totals. No production logic/UI edits.
- Checks: npm run lint PASS; npx vitest run PASS (107 files, 1137 tests); npm run typecheck PASS including current preview harness; git diff --check PASS.
- Protected scope unchanged: src/lib/financial, DB/migrations, auth/RLS (except ignored preview middleware line), billing, getDashboardData and net-worth-baseline. No install/network/commit/push.
- FOR CLAUDE (UI): code inspection confirms auto amount columns, wrapping, dark highlight, Not yet state and 88px sparkline; browser rendering at 390px/dark mode was not exercised in this review. Keep visual QA as the remaining acceptance check. Ignore/remove temporary preview harness before commit as planned.

### 2026-10-19 — Codex → Grok / Claude (PDF-IMPORT-REVIEW)

- Reviewed full `git diff origin/staging`, including Claude's dirty UI changes. Fixed parser column collisions / excess tokens, balance inference crossing rejected rows or mixed date order, and extraction pre-abort/error mapping/password cleanup. Changes: engine.ts, pdf-extract.ts, tests/pdf-import.test.ts, tests/pdf-extract.test.ts, this board. UI/markup unchanged.
- Validation: `npm run typecheck`, `npm run lint`, `npx vitest run` all pass; 108 files / 1167 tests. No DB/migrations/auth/RLS/billing/financial formulas changed. CSV text formula escaping and unnamed password/local-only PDF path reviewed.
- Non-blocking: package-lock removes 52 unrelated libc metadata entries; no existing versions upgraded (only PDF.js + optional canvas additions). Lockfile untouched per scope. Yearless dates unsupported (explicit two-/four-digit BE/CE years tested across Dec/Jan). Worker URL is bundled/local by static review; actual deployed browser/CSP not exercised by mocked extraction tests. PDF.js 6.4.299 exceeds stated CVE-2024-4367 fixed threshold; current CVE inventory not checked because network prohibited.
- FOR CLAUDE (UI): no required UI changes identified. Next: review local patch and deployment worker smoke check. No package installation, network, commit or push performed.


### 2026-10-19 — Claude → Codex (PDF-IMPORT-UI)

- เปลี่ยนเฉพาะ UI ใน `statement-import-flow.tsx` และ selector ปุ่ม "อ่านไฟล์" ใน `tests/e2e/statement-import-live.spec.ts` (regex เดิม `อ่านไฟล์ CSV` ไม่ตรงกับปุ่มจริงอยู่แล้ว)
- ให้ Codex ตรวจ: (1) `selectFile` เรียก `isPdfFile` ตอนเลือกไฟล์เพื่อแสดงช่องรหัสผ่านเท่านั้น (2) ช่องรหัสผ่าน mount/unmount ตามเงื่อนไข — ref ยังเป็น `null` ได้ โค้ดเดิมใช้ optional chaining อยู่แล้ว (3) error ของ PDF ใช้ copy ตาม `error.code` แทน `error.message` สองภาษา

### 2026-10-19 — Codex → staging supervisor (STAGING-SEC-E2E)

- Added migration 0046 and one shared staging-only URL guard before admin-client construction in demo-account and all 20 live e2e specs using service-role clients.
- Validation: typecheck, lint and full Vitest passed (105 files, 1102 tests), including guard rejection cases. No live tests or DB changes executed.
- Next: push `codex/staging-sec-e2e-guard`, open generic PR into staging, wait for every check and merge only if all pass. Supervisor applies 0046 separately via Supabase MCP to staging `eovyvlesdgygjqrrvpas`; no production/main work authorized. Final PR and merge status: `/workspace/reports/staging-sec-e2e-pr.md`.

### 2026-10-19 — Codex → staging reviewers (MONEY-IMPORT-TESTS)

- Added 51 unit cases across the four existing money/import suites: UUID and nested mapping validation, direct fingerprint stability/identity, cents conversion and decimal formatting, and header-mapping boundaries.
- Tests and this collaboration board are the only changes; production logic is unchanged. All exported money helpers now have direct coverage.
- Validation: typecheck, lint, and full Vitest passed (104 files, 1087 tests). Next: push `codex/money-import-unit-tests`, open PR into staging, wait for every check, and merge only if all pass as explicitly authorized by the user. Final PR URL and merge outcome: `/workspace/reports/money-import-tests-pr.md`.

### 2026-10-19 — Codex → staging reviewers (ANIMATED-RM-01)

- AnimatedNumber starts animated state at zero and renders the final value directly under reduced motion, matching SplitMoneyAmount; no styling changes.
- Added five regression cases covering the post-hydration preference change for all formats, updated values, and normal-motion initial state. Four cases fail against the original implementation.
- Validation: typecheck, lint, and full Vitest passed (104 files, 1036 tests). PR: https://github.com/techhealthhero-cmd/Wealth-OS/pull/8 into staging; merge only after all checks pass; outcome recorded in `/workspace/reports/animated-number-pr.md`.

### 2026-10-19 — Codex → Parent (LOGIC-HOME-01)

- Completed on `codex/logic-fixes`: Home badge selects the latest stored snapshot date in the immediately preceding calendar month, using profile timezone (Bangkok default) to identify today. Missing prior-month history uses the existing no-history state; no daily/older-month substitution.
- Month card display and current/previous transaction windows share one timezone-aware calendar date; pure helpers in `src/lib/date.ts` and `src/features/dashboard/net-worth-baseline.ts` have focused unit coverage.
- Verification: `npm run typecheck`, `npm run lint`, `npx vitest run` all passed (103 files, 1031 tests). No money-formula, UI styling, DB/auth, migration or snapshot-writer changes.
- Commit blocked: `git add` and `git commit` fail creating `/workspace/Wealth-OS/.git/worktrees/logic-fixes/index.lock` (read-only filesystem). Changes remain unstaged. Next: parent stage and commit the completed patch in a writable Git environment; no PR, merge, push or QUEUE.md edit performed. Result summary: `/workspace/wt/logic-fixes-prompts/fix-result.md`.

เพิ่มรายการใหม่ไว้ด้านบน ไม่ต้องคัดลอกประวัติการแก้ไฟล์ทั้งหมด

### 2026-10-19 — Grok → เจ้าของโปรเจกต์ (UI-HOME-A)

- งาน: Home redesign variant A ตาม mock 'Finance Home Redesign'; Claude Code ลงมือ, Codex review (read-only) ผลคือ NO BLOCKING FINDINGS; non-blocking a11y (เปอร์เซ็นต์ในแถบ) แก้แล้ว
- ตรวจแล้ว: typecheck / lint / vitest ผ่าน; ภาพหน้าจอ 390x844 จาก harness mock แบบ local (ไม่ commit)
- ข้อสังเกต: `AnimatedNumber` (shared) มีรูปแบบเดียวกับบั๊กที่เจอใน `SplitMoneyAmount` — เมื่อเปิด reduced-motion อาจค้างที่ 0 หลัง hydrate; ยังไม่แก้เพราะอยู่นอก scope
- ขั้นถัดไป: เจ้าของโปรเจกต์ตรวจ Vercel Preview ของ PR

### 2026-10-19 — Grok → เจ้าของโปรเจกต์ (Night Report)

- งาน/เป้าหมาย: ปิด AUTO-INFRA-01/02, AUTO-CLEAN-01 ผ่าน PR #1; ทำ AUTO-SEC-01 triage
- ทำเสร็จแล้ว: PR #1 เพิ่ม README Node 22+ (`a2e2f1e`); Codex review แบบ read-only = APPROVE (คอมเมนต์ใน PR #1); Claude Code ร่างรายงาน SEC-01
- การตรวจที่รันและผลลัพธ์: Node 22.23.3 และ 24.22.0 — `npm ci` OK, typecheck OK (รันซ้ำ 2 ครั้ง), lint 0 problems, Vitest 1023/1023
- ข้อจำกัด: SEC-01 เข้า stop condition → ไม่ push รายงาน รอเจ้าของโปรเจกต์ตัดสินใจ; ไม่มีการเปลี่ยน dependency/lockfile
- ผลลัพธ์: เจ้าของโปรเจกต์ merge PR #1 แล้ว (merge commit `7f62e87`, 2026-10-19 00:50 Asia/Bangkok) รวม README Node 22+
- ขั้นต่อไปที่ชัดเจน: เจ้าของโปรเจกต์ตัดสินใจเรื่อง SEC-01
- คำถามที่ต้องการคำตอบ: อนุมัติแผนแก้ตามรายงาน SEC-01 หรือไม่

### 2026-10-19 — Codex → Claude

- งาน/เป้าหมาย: สร้างเส้นทางตรวจคุณภาพที่ปลอดภัยสำหรับ Grok nightly automation
- เอกสารหลัก: `CLAUDE_GROK_AUTOMATION_HANDOFF.md`
- เริ่มก่อน: AUTO-INFRA-01 และ AUTO-INFRA-02
- รักษาไว้: ห้ามใช้ production credentials, ห้ามแตะ dirty files นอก scope, ห้าม audit fix แบบ force
- ขั้นต่อไป: Claude ส่ง patch และผลตรวจให้ Codex review ก่อนเริ่ม safe build profile

### 2026-10-18 — Codex → Claude

- ผลลัพธ์: Brand & Marketing masters พร้อมใช้ครบ 5 ไฟล์
- ตำแหน่ง: `assets/artwork/masters/brand-marketing/`
- ขอให้ทำต่อ: จัด template ของ Feature Announcement, Product Preview และ Social Share
- รักษาไว้: องค์ประกอบหลัก สี บุคลิกเส้น และพื้นที่ว่างรอบ subject
- ตรวจให้ครบ: mobile/desktop, light/dark, Thai/English copy และ social-safe area
- เมื่อติดตั้งเสร็จ: อัปเดต Active Work และส่งภาพหน้าจอจริงกลับให้ Codex ตรวจ

### 2026-10-19 — Codex → local reviewer (CAPTURE-EMERGENCY)

- Fixed emergency source intent in Quick Capture and voice recap: source/chatter stripped before classification and description. Expanded food dictionary. Exact reported sentence now produces Food & Dining / เบอร์เกอร์ / ฿20.
- Resolution: active linked account first, then active emergency name/purpose; overrides cash/bank and merchant hints. Bare เงินสำรอง intentionally excluded because general reserves are ambiguous. Archived/unknown links ignored.
- ParsedCapture.isEmergencyFundDraw always present. emergencyFundAccountMissing indicates unresolved expense source while retaining default account; missing still means absent fields and suggestedAccountId remains merchant-specific. No warning UI added. AI merge preserves source fields and cleaned description.
- Read-only authenticated/RLS lookup wired into Quick Capture, Voice Notebook and AI assist; accounts purpose included in AI query. Recap already spreads parsed fields, requiring no recap implementation change.
- Checks on installed Node 22: capture 12 files / 234 tests passed; full Vitest 116 files / 1393 tests passed; ESLint changed code/tests passed; next typegen + tsc --noEmit passed; git diff --check passed. Used --configLoader runner because default bundling writes into read-only shared node_modules. Initial Node 20 full run failed an unrelated PDF test (Promise.withResolvers); supported Node 22 resolves it without test changes.
- No migrations, RLS/auth policy changes, money-formula changes, commits or pushes. Next: PR to staging; warning UI (part b) is Claude's mockup task.
### 2026-10-19 — Grok Bot → owner (VOICE-PAPER-TAP, follow-up to PR #34)

- Root cause reproduced in Playwright WebKit (iPhone 13, 390px, touch): #34 focused the textarea on pointerdown; the same tap's compatibility mousedown on the non-focusable paper then blurred it (event log: pointerdown → focusin textarea → … → mousedown → focusout textarea → click). Long-press worked because it landed on the textarea itself.
- Fix: blank-paper focus runs in the paper's onClick, synchronously, no preventDefault; พิมพ์เอง uses the same `focusPaperEnd` helper. Cards/buttons/inputs still excluded by `isEmptyPaperTapTarget`. Page-turn listener lives on the swipe wrapper; the notebook is portaled to body, so it never sees these touches.
- Checks: WebKit tap in the blank middle → activeElement = paper textarea (before: BODY); tap on a note card does not steal focus; lint/typecheck/full Vitest green. Emulation cannot raise the iOS keyboard — owner please confirm on iPhone.

## Handoff Template

คัดลอกส่วนนี้เมื่อส่งต่องาน:

```md
### YYYY-MM-DD — <ผู้ส่ง> → <ผู้รับ>

- งาน/เป้าหมาย:
- ทำเสร็จแล้ว:
- ไฟล์ที่เปลี่ยน:
- การตรวจที่รันและผลลัพธ์:
- ข้อจำกัดหรือสิ่งที่ห้ามเปลี่ยน:
- ขั้นต่อไปที่ชัดเจน:
- คำถามที่ต้องการคำตอบ:
```

## Resume Packet Template

ใช้ส่วนนี้เมื่อหยุดเพราะลิมิต เวลาหมด หรือยังทำงานไม่ครบแผน:

```md
### YYYY-MM-DD — Resume Packet: <รหัสงาน>

- Objective:
- Owner:
- Current status:
- Completed checkpoints:
- Current checkpoint:
- Files changed / files in scope:
- Tests or checks already run:
- Decisions that must be preserved:
- Known blocker or risk:
- Next action (ทำข้อนี้ก่อนเพียงข้อเดียว):
- Remaining checkpoints:
```

## Definition of a Good Handoff

การส่งต่องานที่ดีต้องทำให้อีกฝ่ายเริ่มต่อได้โดยไม่เดา: รู้ว่าเป้าหมายคืออะไร อะไรเสร็จ
อะไรยังไม่เสร็จ ไฟล์ใดเกี่ยวข้อง ตรวจอะไรแล้ว และการตัดสินใจใดห้ามเปลี่ยนโดยเงียบ ๆ

### 2026-10-19 — Codex → owner (TOUCH-CURL-RECOVERY)

- SwipeTabPages now listens on the original touch target for each gesture via a DOM-agnostic helper; wrapper only listens for touchstart. End/cancel and unmount dispose target listeners, including detached targets.
- New starts recover stale drag/back-preview sheets; pagehide/hidden visibility and effect cleanup remove drag/settling sheets and restore live opacity when no flight runs. Settle cancellation owns its sheet after drag refs are cleared. Existing flight/navigation/snapshot paths retained.
- Added four Node EventTarget regression cases in tests/touch-gesture.test.ts for target binding, detached end/cancel, listener removal/disposal and repeat gestures.
- Validation under existing /home/box/.local/node22/bin runtime: npm run lint PASS; npx tsc --noEmit PASS; npx vitest run PASS (122 files, 1451 tests). Initial default Node 20 run failed the unrelated PDF legacy test (Promise.withResolvers); reran with the repo-required Node 22 without test changes/skips.
- No git commands, commits, pushes, dependencies or harness edits. No device/CDP rerun; next acceptance step is owner iPhone check.

### 2026-10-19 — Codex → owner (CURL-CONTENT-READY)

- Added a 900ms bounded skeleton observer before forward release/back snapshot; flight identity, wrapper ownership, unmount cleanup and the existing 5s maximum guard cover interrupted/cross-section turns. Existing gesture helper and settle cleanup retained.
- Sheet faces/underlays clip and contain paint to viewport; snapshot backdrop filters disabled. Active turns pause live skeleton shimmer; landing finishes running finite CSS animations. Section markers use right-origin scale transforms with reduced-motion transitions disabled.
- Added five Node tests for ready content, final skeleton removal, timeout, cancellation and finite CSS animation finishing. Clone reuse intentionally deferred: drag-created sheet ownership/coordinates make it more than a straightforward safe change.
- Node 22 validation: typecheck PASS; Vitest PASS (123 files / 1456 tests). Lint PASS. Default login shell initially selected Node 20 and failed existing PDF built-ins coverage; all requested checks rerun explicitly with Node 22, no tests skipped/disabled.
- No git commands, dependency changes or edits to protected harness/proxy paths. Device Safari review remains the acceptance step.

### 2026-10-19 — Codex → owner (TAB-STRIP-STILL)

- Supersedes the 2026-10-14 title + strip turn decision: sheet top is max(wrapper top, main top, 0), with viewport-bottom height and existing corner/nav clearance math. Main clones retain screen alignment; saved faces/underlays and ruled-paper backgrounds use main-top minus sheet-top.
- SegmentedTabs now transitions only color/background-color/box-shadow. A layout effect reveals clipped active tabs by setting only the nav scrollLeft; the positioned nav supplies the offsetLeft coordinate origin. Static active padding and reduced-motion behavior retained.
- Verified Money/Plan/Earn layouts → section tabs → SegmentedTabs have no pathname keys; layouts unchanged. Earlier gesture, settle cleanup, readiness cap, clipping, shimmer pause, animation finishing, marker transform and onStart live-flight recovery retained.
- Files: src/components/layout/swipe-tab-pages.tsx, segmented-tabs.tsx, new tab-strip-scroll.ts; tests/tab-strip-scroll.test.ts; this board.
- Node 22.23.3: npm run lint PASS; npx tsc --noEmit PASS; npx vitest run PASS (124 files / 1461 tests). Five helper cases cover visible/edge tabs, clipped left/right, padding limits and non-overflow bounds. No tests skipped/disabled.
- No git commands, dependencies or protected harness/proxy edits. Next: owner device visual review of Money/Plan/Earn turns, cross-section turns and close-book.

### 2026-10-19 — Codex → owner (VOICE-PAPER-TAP)

- Added a primary-pointer handler only on the paper scroll container. It synchronously focuses the mounted textarea and places the caret at the end; native textarea taps, note cards and controls are excluded. Existing onFocus mic-stop behavior remains.
- Files: voice-notebook.tsx, voice-notebook-paper-tap.ts, tests/voice-notebook-paper-tap.test.ts, this board. Protected capture/parser/curl files untouched; no commit/push.
- Node 22.23.3: requested Vitest command passed (1 file / 11 tests); changed-file ESLint and diff check passed. Initial tsc needed generated LayoutProps; next typegen followed by tsc --noEmit passed.
- Next: owner iPhone Safari check for blank-paper keyboard opening, native caret selection and mic start/stop. No physical-device verification in this session.


### 2026-10-19 — Codex → owner (SMART-CAPTURE-COLUMNS)

- Completed the requested code/test changes on `codex/smart-capture-columns-loans`. Assets/liabilities use 0048 columns and short capture markers; 42703/PGRST204 insert fallback preserves legacy notes. Recovery reads columns, previous payment/recurring rows, or legacy JSON for older rows.
- Loans create a deterministic validated `other` ledger account, link the liability, then use `create_transfer` with the original capture request key. Existing income-based loan captures remain compatible without backfill.
- Owned recurring liability links include split final schedules; retry after 0048 can fill a link omitted by fallback. Before 0048 those fallback schedules retain ordinary recurring behavior.
- Repayment uses the tested cents helper, occurrence precheck, unique-key handling and optimistic balance update. Linked debt posts principal transfer + interest expense; calendar sums both. Missing interest can be repaired on retry. A failed balance update preserves the payment and returns `balanceUpdateFailed`; reconciliation is deliberately not attempted by replaying a payment.
- Shared missing-rate input and month/year controls pass through text, recap and voice, with validated server overrides and live preview/warnings. Tests include server mocks, legacy compatibility, concurrent confirms, calendar summing, pure math/net worth, draft overrides and rendered components.
- Validation under Node v22.23.3 (`login: false`): full `npx vitest run --configLoader runner`: **140 files / 1960 tests passed**; `npm run -s typecheck` passed; ESLint all changed TS/TSX passed; `git diff --check` passed. An earlier Node 20 run failed the existing PDF test; switching to the supplied Node 22 resolved it without changing/omitting tests.
- No database, migrations, secrets, commit or push used. Future proposal only: add a DB same-user ownership trigger for `recurring_transactions.liability_id` (current code checks ownership before linking and confirming). Multi-step writes remain independently retryable rather than atomic across tables.
- Next action: owner review the local diff.

### 2026-10-19 — Codex → owner (SMART-CAPTURE-BLOCKING-REVIEW)

- Reviewed uncommitted money/ownership/0048 compatibility/recurring/rate-input changes against prompt.md.
- Fixed zero-down retries posting an edited down payment; asset-insert failure retries now recover original principal from the liability before schedules can mutate it. Payment recovery read errors fail closed when ancillary installment rows exist.
- Invalid effective smart drafts remain on the server-validated smart route rather than falling through to ordinary expense/income posting.
- Added three regressions. Final Node 22 checks: requested full Vitest 140 files / 1963 tests passed; npm run -s typecheck passed; npm run -s lint passed; git diff --check passed.
- No commits, pushes, database access, migrations or disabled tests. Next: owner review local fixes. Optional future DB ownership trigger remains defense in depth; browser/device interaction was not exercised.

### 2026-10-19 — Codex → owner (COVER-SWIPE-OPEN)

- Added `cover-swipe.ts` pure math and five tests in `tests/cover-swipe.test.ts`; `use-cover-swipe.ts` handles primary pointer capture, recent 100ms velocity, maximum tap movement, rAF transforms, release/cancel/lost capture and animation cleanup. Overlay isolates pointer/touch events and suppresses clicks after drags.
- HomeBook supplies an optional face ref to LaunchStillScene; default fallback/splash markup and original wrapper pose/perspective remain unchanged. Successful swipes finish rotation in 220ms then set open directly, avoiding replay of a closed cover. Taps/keyboard retain the existing quick opening. Failed swipes spring back in 380ms; reduced motion skips follow/release animation.
- Thai/English tapToOpen copy updated; closedHint retained. No RTL setup exists, so component test omitted; Node math tests cover clamping, thresholds, flick direction/distance and diagonal/vertical taps.
- Validation: targeted notebook/gesture 3 files / 27 tests passed; Node 22 full `npx vitest run --configLoader runner` 143 files / 1996 tests passed; `npm run typecheck`, `npm run lint`, diff check passed. Initial login shell reset PATH to Node 20 and failed existing PDF built-ins test; checks rerun with supplied Node 22 PATH (`login: false`), no tests changed/skipped.
- No commits, pushes, remote changes, secrets or dependencies. Physical iPhone/390px gesture/visual verification remains for owner review.

### 2026-10-19 — Codex → owner (COVER-BACKFACE)

- Swipeable LaunchStillScene now has cream ruled paper, rose margin, gutter and stacked edges; rotating wrapper contains separately hidden front/back faces with WebKit properties. Static branch/pose unchanged.
- Shading CSS variables are written with rotation in rAF; release uses pure duration/easing helpers and current painted angle, reduced motion remains immediate. Snap-back clears transform/will-change and resets lighting.
- Checks: requested focused Vitest 9/9; focused ESLint PASS; tsc PASS after next typegen repaired missing generated LayoutProps; git diff --check PASS. No env/secrets, commit or push.
- Harness selectors: [data-cover-wrapper] gets coverFaceRef; its children [data-cover-front] and [data-cover-back]; sibling [data-cover-page].
- Grok Bot follow-up: front/back side also toggled explicitly past 90deg (coverSideShowing) because Playwright Linux WebKit ignores backface-visibility/preserve-3d; book drifts/squares up with the cover like nb-quick-book (bookPoseFromAngle, closed pose byte-identical); will-change kept through the release tween. Playwright WebKit iPhone 13 harness: drag 45/120/165deg, release, snap-back, tap, keyboard, reduced motion, static still, rAF throttling all PASS.
### 2026-10-19 — Codex → owner (INVOICE-UI)

- Built approved list A, create/edit, detail and reminder flows under `/money/invoices`; Money title/tabs hidden only there, existing bottom nav remains active. All reads follow activity privacy gate; user-scoped history/accounts paginate and fail closed. UUID/calendar validation retained, missing 0047 uses existing localized error.
- Pure UI helpers cover due +15 calendar days, historical client dedupe/filter, WHT suggestions, tab counts/sorting, Thai Buddhist dates, invoice text/LINE sharing and three courteous Thai reminder tones/endings. Existing financial functions supply every total. Reminder edits survive tone/ending changes until explicit regeneration; ending persists locally.
- Screens accept data/copy and action callbacks (full signatures and sample fixture references in `src/features/invoices/README.md`). Create retains successful ID if sending fails; detail has Copy/LINE only, clipboard fallback, draft-to-sent, payment confirmation/account/date, suggestion toast, edit and cancel. No public link/PDF/remind-again box. Payment uses existing RPC; tax reserve is suggestion only.
- Home invoice quick action and expected tile are real links. New copy lives in TH/EN invoiceUi; Home hint updated. Actions changed only for detail-path revalidation. No env/secrets, supabase/, migrations or src/lib/financial edits; no commits/pushes.
- Final validation under supplied Node 22.23.3: `npx vitest run --configLoader runner` PASS (147 files / 2067 tests); `npx tsc --noEmit` PASS after `npx next typegen` generated existing missing LayoutProps; `npx eslint src tests` PASS; `git diff --check` PASS. New coverage includes pure helpers, rendered states, query scoping/errors/pagination and Home wiring.
- Visual limitation: isolated harness bundled in `/tmp/invoice-ui-review`, but local listen returned EPERM and Chromium launch was blocked by the sandbox. No live Supabase writes or real-device validation performed. Editable fields/issue date/notes/account and payment dialogs add space beyond static mockups; app shell nav retained.
- Next: owner render the four exported screen components with sample props for 390px/light/dark/desktop visual acceptance, then review real authenticated flows. Changes remain uncommitted on feat/invoice-ui.

### 2026-10-19 — Codex → owner (INVOICE-UI-WEBKIT-FOLLOWUP)

- Removed full TH/EN JSON imports from ui-logic.ts. Share/reminder helpers require injected Dictionary["invoiceUi"] copy (type-only import); screens and tests updated, including custom-copy regression coverage.
- Create/edit issue/due fields render Thai Buddhist dates above full-size opacity-0 native date inputs with accessible labels and visible focus rings. Automatic due state remains until the user edits due; issue changes update an untouched due date. Relative +N-day helper sits inside the due field.
- Item fields use text + decimal inputMode; new unit prices are empty with a placeholder and quantities default to 1. Quantity syntax rejects more than two decimal places; existing exact cents price parsing and validation messages retained. Description sits above the compact quantity × price line and right-aligned total.
- Shared rounded bg-card appearance-none selects with chevrons cover WHT and receive accounts (including payment dialog). Kept Prettier print-width 120 style.
- Node 22.23.3: npx vitest run --configLoader runner PASS (147 files / 2068 tests); npx tsc --noEmit PASS; npx eslint src tests PASS; git diff --check PASS. No new browser/device screenshot run during this follow-up.
- No commits/pushes or changes to src/app/dev-harness/, src/lib/supabase/middleware.ts or .env.local. Existing uncommitted work preserved. Next: owner repeat 390px WebKit visual and native-picker acceptance.


### 2026-10-19 — Codex → owner (INVOICE-UI-WEBKIT-DIALOG)

- Renamed the existing shared native-picker overlay to ThaiDateField and reused it in the form and paid-date dialog. Thai Buddhist display, accessible native input, focus ring and max=today retained.
- DialogContent accepts an optional overlayClassName, preserving other callers. Invoice dialogs use z-60 darkened backdrop and z-61 popup above BottomNav z-30. Mobile layout anchors to the bottom with rounded top and safe-area padding; sm+ stays centered and rounded.
- Detail success feedback remains a toast plus an sr-only polite live region. Clipboard-failure fallback keeps its visible, read-only selectable textarea.
- Added shared-date and visible-fallback regressions plus a detail live-region assertion. Node 22.23.3: npx vitest run --configLoader runner PASS (147 files / 2070 tests); npx tsc --noEmit PASS; npx eslint src tests PASS; git diff --check PASS.
- No commit/push or changes to src/app/dev-harness/, src/lib/supabase/middleware.ts or .env.local. Existing uncommitted work preserved. No new browser/device run; next: owner repeat 390px WebKit dialog layering, safe-area and native-picker acceptance.

### 2026-10-20 — Codex → owner (THAI-CAPTURE-FIXES)

- Added bounded Thai cardinal normalization; protected trailing date words from counted units. Recap masks tax/term/rate numbers and attaches these qualifiers to their original item, including before a following expense. Amount spans exclude masked trailing whitespace so installment notes survive saving.
- WHT example stays one gross income row (15000); existing description carries 3%, 450 tax, 14550 net and retains ณ. Existing installment payments remain saveable expenses with number/total/remaining metadata and persisted description; no guessed principal, new asset or duplicate liability. Existing smart purchases, splitInstallment formulas and loan ledger + linked-liability + create_transfer persistence remain unchanged.
- Income cues take precedence over subscription proposals. Foreign currency leaves the THB amount empty and adds a prioritized gentle Thai confirmation question to the existing confidence gate. Work Support/Freelance category keywords reuse existing category names/ids.
- Added 36 focused cases and 30 manually labelled corpus examples (350 total). Original baseline fixture/labels unchanged; baseline assertions evaluate their original 320-case cohort, while all new labels get exact field/eligibility/reason/question assertions and the full corpus retains safety checks.
- Validation with installed Node 22.23.3: full Vitest 148 files / 2113 tests passed; scripts/nlp-eval.mjs passed, criticalFailures=[] and autoSavePrecision=1; tsc --noEmit passed after next typegen regenerated existing missing LayoutProps; eslint src tests and diff check passed. npx -y node@22 could not resolve registry.npmjs.org (EAI_AGAIN), so invoked its already installed Node 22 binary directly for Vitest/eval; also ran requested npx tsc/eslint successfully with Node 22 on PATH.
- No commits, external APIs, UI, schema, Supabase/auth/RLS or money-formula edits. No required schema follow-up. Optional future UI work can expose installment metadata for choosing an existing liability; this parser never guesses a liability link. Next: owner review local diff.

### 2026-10-20 — Codex → owner (THAI-CAPTURE-REVIEW)

- Reviewed staged diff against origin/staging. Fixed phantom Thai cardinal amounts in normal words/labels, ability ได้ misclassifying expenses (including unknown-unit type fallback), foreign-currency name substring false positives, and เดือนละ masking a real price. Added 17 regressions; preserved existing staged work and left review fixes unstaged.
- Rent duration and percentage cases retain real prices; standalone percentages remain unpriced. WHT gross/tax/net and installment descriptions persist correctly; no additional blocking description findings.
- Installed Node 22: full Vitest 148 files / 2130 tests PASS; NLP eval 350 cases criticalFailures=[] and autoSavePrecision=1; next typegen + tsc --noEmit PASS; eslint src tests PASS; diff check PASS.
- No commits, pushes, dependency, UI, DB or schema changes. Next: owner review combined staged + unstaged diff.


### 2026-10-20 — Codex → supervisor (INVOICE-QA-FIXES)

- Worked only on `codex/invoice-qa-fixes` in `/tmp/wos-invoice-qa`. Claim/checkpoints above. Invoice design A, layout/classes/colors and protected capture file unchanged; no secrets, network/DB writes, schema, migrations, RLS, billing or formula edits.
- Bug 5: dialog awaited the server response, including suggestion/revalidation work. Urgent local state now closes/paints paid before invoking the action; returned/thrown failures restore the prior invoice and toast the localized error. Existing tax-jar suggestion/unavailable feedback retained. Server action inspected: settings-before-RPC guards safe retry; authoritative post-commit net read supports idempotent suggestions; route invalidations serve real dependent views, so retained. Shared context now reuses request-cached auth/profile/context instead of repeated direct auth calls.
- Bug 6: reminder previously loaded items and account name through sequential queries and reloaded auth/context. Header-only reminder mode avoids these unused reads; privacy/ownership and sent-only redirect remain. Detail/edit invoice/form-context and history/accounts read in parallel. Copy feedback uses a screen-specific toast ID, 1200ms duration, route/unmount cleanup and ignores late clipboard completion; reminder navigation dismisses immediately via `onNavigate` (new-tab clicks unaffected).
- Bug 7a: separate form/detail fallback logic had no common account resolver. Shared pure helper prefers valid invoice account, valid recent-account preference, then only active account. Multiple accounts without preference remain unselected. No schema default-account field exists. Editable unavailable accounts display unselected consistently; paid history preserves its recorded name. Route keys prevent optimistic/edited state carrying across invoice IDs.
- Bug 7b audit: SQL issue/due/paid columns are dates, mapped verbatim; list header is today, not the invoice issue date. Source already derives today from profile timezone with Bangkok fallback and formats/adds calendar days independently of process TZ. Supplied 23:30/00:00 Bangkok cases pass without production date changes. No confirmed root cause for observed shifted date; no stored date repair attempted.
- Final checks on Node 22: `npm run typecheck` PASS; `npm run lint` PASS; `npx vitest run` PASS **151 files / 2148 tests**. `TZ=UTC npx vitest run tests/invoice-qa-logic.test.ts tests/invoice-payment-ux.test.ts tests/invoice-copy-toast.test.ts` PASS **3 files / 14 tests**. Diff whitespace check PASS. Added 18 regressions across helpers, deferred payment events/rollback/suggestion, copy lifecycle, query reads and account-render contracts.
- Self-review against origin/staging: create/edit/send/void and RPC payload/persistence unchanged; tax suggestions retained; list tabs/totals and reminder tone/ending/edited text/LINE/fallback behavior unchanged. Native date/dialog accessibility, 390px classes, safe-area and loading skeletons retained. No browser/iPhone/authenticated end-to-end latency measurement performed.
- Commit blocker: attempted `git add` and the requested `git commit`; both failed with `Unable to create .git/index.lock: Read-only file system`. Changes remain unstaged, no commit was created. No push/PR. Supervisor must stage these scoped files and commit with `fix(invoices): fast mark-paid, faster remind page + scoped copy toast, preselect receiving account, timezone-safe dates` in a writable Git environment.
- Resume Packet: implementation and all required checks are complete; supervisor commit is blocked only by read-only Git metadata. Remaining bug diagnosis is 7b only. First next step: obtain one affected invoice's original issue-date input, stored issue_date, creation timestamp and profile timezone from the owner to distinguish stale/deployed UI or an already incorrect stored date. No DB changes are authorized for that follow-up.

### 2026-10-20 — Codex → supervisor (VOICE-PAPER-TAP2)

- Code diagnosis: short textarea left most empty paper as div hit areas; #42 relied on delegated click, and bottom mic surround had no paper handler. iOS div click delivery/compat mousedown makes that approach unreliable; explicit focus:bg highlight caused the yellow field. Git/code inspected because gh API unavailable.
- Stable textarea now grows into spare paper height while retaining content auto-height (empty page only; with cards it keeps text height); native taps on text keep the tapped caret position, blank-paper taps put the caret at the end. Wrapper covers paper + bottom area, excluding header and picker. Passive start/move track single touch, reject excursions >10px; non-passive touchend focuses synchronously and cancels compat mouse only for empty targets. Controls/cards retain behavior. CSS clears field background/outline/shadow in all focus states and paper tap flash.
- Node 22: npm run typecheck PASS; npm run lint PASS; npx vitest run PASS (148 files / 2141 tests); git diff --check PASS. Self-review against origin/staging: mic onFocus stop, inset hiding, type button, picker/cards, save and dark colors retained; no persistence/formula/auth production changes.
- Local only, never stage: src/app/dev-harness/voice-paper/page.tsx and harness.tsx; .harness/verify.mjs; src/lib/supabase/middleware.ts exact-route bypass. Harness intercepts server actions before mount to avoid Supabase, supports ?rows=1, nine tap points, mic/header exclusions, synthetic vertical swipe guard, Thai typing/style assertions and screenshots/results. Native swipe and real iOS keyboard still require physical device review.

- Supervisor (2026-10-20): removed textarea onClick that forced the caret to the end; grow only on an empty page; auto-height measures with flex-grow off (stretched height was being locked in and pushed cards down). WebKit iPhone 13 touch harness: 11/11 paper points focus, mic/header excluded, focused field transparent/no outline. Committed + PR by supervisor.

### 2026-10-20 — Codex → supervisor (CAPTURE-SAVE-VISIBLE)

- Review-first placement and held-mic geometry retained. Follow-up restores the original max-h-[92dvh] cap when keyboard is closed; keyboardInset and listening/holdLayout branches unchanged.
- Reveal helper uses only action/viewport bottoms and clamps delta to zero; effect scrolls only for delta > 0, preserving user scrolling on focusout. Four small pure tests cover fitting, clipped, scrolled-past and boundary cases.
- Supplied Node 22 PATH: npm run typecheck PASS; npm run lint PASS; npx vitest run PASS (149 files / 2134 tests).
- Supervisor reported WebKit iPhone 390×664 + 34px safe-area verification: all three review-first cases have Save fully visible at scrollTop 0 (bottoms 457/499/540; limit 630). No new browser run for this follow-up.
- No git operations or metadata changes. Four scoped files remain for supervisor review and commit; supervisor owns push/PR.

### 2026-10-20 — Codex → owner (QA4-MONEY-TEXT)

- Current /money redirects to /money/transactions. TransactionListBody called formatFriendlyDate with an independent local clock in SSR and hydration; UTC server/Bangkok client can disagree on วันนี้/เมื่อวาน. Calendar and list headings also formatted dates in separate ICU implementations; exact observed WebKit text pair could not be reproduced (browser IPC socket Operation not permitted).
- TransactionList passes its existing profile-timezone today and initial date strings to the body. Calendar localized date/compact-number strings are computed once on the server and serialized; client only reads the snapshot. Shared calendar-date formatters use UTC date-only anchors; friendly helper accepts an explicit reference day and otherwise defaults to Bangkok. No suppression, formula, DB/auth or localStorage changes.
- Node 22 PATH=/tmp/n22bin:$PATH: npm run typecheck PASS; npm run lint PASS; npx vitest run PASS (154 files / 2168 tests). Added two pure tests for crossing Bangkok midnight and UTC/Bangkok process timezone equivalence. Self-review and git diff --check PASS. No next build/start/dev, commits or pushes; files left uncommitted.
- Next: owner rerun production WebKit /money under th-TH/Asia/Bangkok; exact browser mismatch and authenticated end-to-end resolution remain unverified here.


### 2026-10-20 — Codex → owner (QA4-FOLLOWUPS)

- Emergency form reserves a 64px mobile right gutter; companion docks on that edge on this route for restored, resized and dragged positions. On leaving, the stored position for other pages is restored; page docking does not overwrite it. Input-focus hiding and main bottom safe-area reserve retained. Desktop gutter removed.
- formatWeekday uses Thai narrow + dot and English short, preserving UTC date-only anchors and server-rendered snapshots. Both callers are transaction-list heading paths. Tests assert all seven Thai/English weekday pairs, including 2026-10-19 = จ. / Mon; existing timezone test retained. Layout contract tests cover docking/gutter/focus/bottom reserve.
- Node 22 via /tmp/n22bin: npm run typecheck PASS; npm run lint PASS; npx vitest run tests/money-hydration-text.test.ts tests/emergency-fund-blob-layout.test.ts tests/emergency-fund.test.ts PASS (3 files / 25 tests); git diff --check PASS. No browser/device verification; owner should review 390×664 initial scroll and scrolling. No commits or DB/Supabase/auth/RLS/billing/formula edits.


### 2026-10-20 — Codex → owner (W5-FOLLOWUPS)

- Extracted the existing AI button switch into src/components/ui/settings-switch.tsx and reused it for capture large text. Identical track/thumb/focus classes; native button keyboard support, accessible label, switch role and checked state retained. Device store and display-change/storage synchronization untouched.
- Pure buildUnsureQuestion reads draft amount and recipient after โอน…ให้ in the parser-cleaned description, using formatMoney (whole baht or two decimals). Missing recipient omits ให้; missing amount uses รายการนี้คืออะไร?. Choices and pending Save unchanged; existing question was inline Thai, so no dictionary edits.
- Added tests: formats the parsed amount and recipient; formats amount only when no recipient is parsed; uses a generic question when no amount is parsed. Review render test also asserts final question text.
- PATH=/tmp/n22bin:$PATH npx tsc --noEmit PASS; npx vitest run tests/capture-w5-components.test.ts tests/capture-w5-device-store.test.ts tests/capture-w5-display.test.ts PASS (3 files / 58 tests); git diff --check PASS. No browser verification, DB/schema/migrations/formula/auth/RLS edits or commits. Owner may review uncommitted patch.


### 2026-10-20 — Codex → owner (W5-SWITCH-SIZE)

- Added `min-h-0! min-w-0!` to SettingsSwitch and changed the large-text row to a native label with cursor-pointer. Native label activation uses the existing button handler once; native disabled button blocks activation. Accessibility attributes unchanged. Existing unrelated work preserved.
- Node 22: `npx tsc --noEmit` PASS; `npx vitest run tests/capture-w5-components.test.ts` PASS (17 tests); `git diff --check` PASS. No commit. Ready for owner review.


### 2026-10-26 — Grok Bot → staging reviewers (SLIP-KPLUS-OCR)

- Root cause: K PLUS puts the amount under `จำนวน:` and the date as `3 พ.ย. 66`. The parser required `จำนวนเงิน` or a whole line that was only the amount, so leading OCR debris (`. 70.00 บาท`, `2. 70.00 บาท`) became ฿0. Tesseract reads the dot in `พ.ย.` as sara u, so the date was dropped. Default page segmentation also mixed the QR into those lines. The mini-QR still has bank + reference only, not the amount.
- Fix stays on-device: single-column OCR (PSM 4), main-thread HEIC/EXIF decode before the worker, and parser coverage for this layout. Six real JPEGs were checked locally with Tesseract tha+eng PSM 4; all six returned the printed amount and `2023-11-03` plus the correct time. Personal names and account digits are not in the repo; unit tests use synthetic text in the same shape.
- Direction is still a question until the user taps รายจ่าย/รายรับ. That part was already by design.
- `npm run typecheck` PASS; eslint on the touched files PASS; focused Vitest PASS. No production, RLS, auth, billing, or money-formula edits.

### 2026-10-21 — Codex → supervisor (SLIP-POLISH)

- Undo starts the single batch request before closing/resetting and showing the success toast. busyRef prevents duplicate operations without setting the sheet spinner. Snapshot restores saved rows, batch, stage, VM, summary/month, completed IDs and unlearn callbacks on failure and reopens retry UI. Memory unlearning runs only after success in reverse order; refresh and non-awaited summary reload follow. Pending summary reads are invalidated before reset.
- Replaced bare ปั๊ม with explicit fuel phrases; retained station brands and Latin word boundaries (including PT). Tests exercise resolveSlip's normalizer/categorizer path, OCR variants, Thai spacing, all requested pump exclusions and embedded Latin pt negatives. Updated undo orchestration tests use a deferred request to verify request-before-close ordering, failure restoration and success refresh callback.
- Node 22 explicitly via /tmp/n22bin: npm run nlp:eval PASS (358 cases, autoSavePrecision=1, criticalFailures=[]); npx tsc --noEmit PASS after npx next typegen; npm run lint PASS; focused Vitest PASS (64 tests). Full npx vitest run: 167 files / 2469 tests pass, one unrelated tests/slip-assets-offline.test.ts failure because child-process spawnSync is denied (EPERM); isolated forks retry confirms the same environment restriction. No test bypass or unrelated production fix. git diff --check PASS.
- Changes limited to flow/model, keywords, two test files and this collaboration board. No schema/migrations/RLS/auth/billing/formula edits, commits or pushes. Next: supervisor review and rerun the offline-assets test in an environment allowing child-process spawn; physical-device instant-close timing remains unmeasured.
