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

อัปเดตตารางนี้ทุกครั้งที่รับหรือส่งต่องาน เก็บเฉพาะงานที่กำลังทำและงานถัดไปใกล้ที่สุด

| ID | งาน | Owner | Status | Scope / Deliverable | Next handoff |
|---|---|---|---|---|---|
| RESUME-PILL-NAV | Mobile resume pill safe-area clearance | Codex | DONE | Host class/comment + focused rendering regression; inspect nav geometry, run typecheck/lint/related Vitest | PR to staging (screenshots 390px ± 34px safe area) |
| SLIP-PARSE-MATCH | Portable Thai e-slip parser and matcher | Codex | VERIFY — typecheck/lint and 113 files / 1302 tests passed | src/lib/slip + synthetic tests; implement, validate, PR and merge into staging after checks | Codex → staging reviewers; report /workspace/reports/slip-parse-match-pr.md |
| PDF-IMPORT-REVIEW | Full PR #6 diff vs origin/staging; parser/security fixes and required checks | Codex | DONE — no blocking findings remain; typecheck/lint/108 files·1167 tests passed | Non-UI PDF engine/extraction + regression tests; Claude UI untouched | Grok/Claude review unstaged fixes; no commit/push |
| STAGING-SEC-E2E | Staging DB hardening and live-test target guard | Codex | READY FOR HANDOFF — local checks passed | Migration 0046, shared guard, demo/live specs; validate typecheck/lint/full Vitest, PR into staging, merge after all checks pass | Supervisor applies DB separately; report /workspace/reports/staging-sec-e2e-pr.md |
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

### 2026-10-19 — Codex → owner: RESUME-PILL-NAV

- Completed: resume pill uses pages' existing `7rem + env(safe-area-inset-bottom)` clearance; desktop `md:bottom-6` retained. Replaced stale floating QuickAdd FAB comment with current nav-center mic reference.
- Geometry at default sizing: item 20px icon + 2px gap + 16.5px label + 12px padding = 50.5px; nav padding adds 12px = 62.5px; wrapper adds 16px + safe area = 78.5px + inset. Raised mic reaches 93.5px + inset; 112px + inset offset leaves 18.5px gap.
- Files: `src/components/shared/minimizable-form-context.tsx`, `tests/minimizable-form-context.test.ts`, this collaboration board. Two server-rendered regressions cover minimized and minimizing states.
- Validation: initial `npx tsc --noEmit -p .` lacked generated LayoutProps; `npx next typegen` then `npx tsc --noEmit -p .` passed. ESLint on both changed code/test files passed. Default Vitest config loader hit read-only node_modules/.vite-temp; rerun `npx vitest run tests/minimizable-form-context.test.ts tests/nav-notch-path.test.ts --configLoader runner` passed (2 files, 11 tests). `git diff --check` passed.
- Next: PR to staging with 390px before/after screenshots (simulated 34px iPhone safe-area). No migrations, auth/RLS or financial changes.

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
