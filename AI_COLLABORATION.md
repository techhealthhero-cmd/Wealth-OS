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
| SLIP-01 | สลิปอัตโนมัติ: ตั้ง iPhone Shortcut ให้เสร็จ + ปรับระบบหลังทดสอบจริง | Claude | IN PROGRESS (พักโดยเจ้าของโปรเจกต์ 2026-10-26) | ดูรายการ SLIP-01 ใน `TODO.md` | เจ้าของโปรเจกต์เปิดสิทธิ์ความเป็นส่วนตัวของ Shortcut แล้วรันใหม่ |
| ART-01 | Brand & Marketing templates | Claude | TODO | จัด Feature Announcement, Product Preview และ Social Share จาก master ที่อนุมัติแล้ว | ส่งภาพหน้าจอ/ผล QA ให้ Codex ตรวจความสม่ำเสมอ |
| QA-01 | Empty State live QA | Claude | TODO | ตรวจ Notifications และ Forecast ด้วยสถานะจริง | บันทึก viewport, theme และผลตรวจใน `ARTWORK_ROADMAP.md` |
| ART-02 | Brand artwork visual QA | Codex | WAITING | ตรวจ light/dark, mobile/desktop และ social safe area หลังติดตั้ง | รอ Claude ส่งหน้าจอจริง |
| AUTO-INFRA-01 | Fresh-clone typecheck | Grok | DONE — PR #1 merged (`7f62e87`) | `npm run typecheck` = `next typegen && tsc --noEmit` (ไม่มี script `typegen` แยก ตามที่เจ้าของโปรเจกต์ตัดสิน) ผ่านบน Node 22/24 จาก `.next` ว่าง; Codex review = APPROVE (https://github.com/techhealthhero-cmd/Wealth-OS/pull/1) | — |
| AUTO-INFRA-02 | Pin Node 22+ | Grok | DONE — PR #1 merged (`7f62e87`) | `.nvmrc`=22, `engines.node >=22`, README Node 22+; `npm ci` ไม่มี EBADENGINE บน Node 22.23.3 และ 24.22.0 | — |
| AUTO-INFRA-03 | Safe bot build profile | Claude | TODO | Build โดยไม่ใช้ production secrets/network writes | Codex security review ก่อน Grok ใช้ |
| AUTO-SEC-01 | npm audit triage | Claude (tracking: Grok) | ESCALATED | รายงานเสร็จ (Claude Code ร่าง, Grok ตรวจ) บน branch local `claude/auto-sec-01-audit-triage`; เข้า stop condition จึงยังไม่ push; ไม่มีการเปลี่ยน dependency/lockfile | เจ้าของโปรเจกต์ตัดสินใจจากรายงานที่ส่งตรงให้ |
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

เพิ่มรายการใหม่ไว้ด้านบน ไม่ต้องคัดลอกประวัติการแก้ไฟล์ทั้งหมด

### 2026-10-26 — Claude → ทุก agent

- งาน/เป้าหมาย: ระบบสลิปอัตโนมัติ (iPhone Shortcut + เลือกหลายสลิปพร้อมกัน) รอผู้ใช้กด ✓ ก่อนหักยอด
- ทำเสร็จแล้ว: migration `0046_slip_inbox.sql`, `/api/capture/slips`, `src/features/slip-inbox/`, `/profile/slip-shortcut`, การ์ด "สลิปรอยืนยัน" ในแท็บรอตรวจ, /help — รายละเอียดใน `PROJECT_STATUS.md`
- การตรวจ: 1060/1060 tests, typecheck, lint, build, ภาพหน้าจอ 390px
- ข้อจำกัด: 0046 ยังไม่ได้ push ขึ้นฐานข้อมูล; ยังไม่ได้ทดสอบกับ Shortcut บน iPhone จริง
- ขั้นต่อไป: เจ้าของโปรเจกต์รัน `supabase db push --linked` → Claude ตรวจตารางแบบ read-only + live e2e
- รักษาไว้: แอป App Store ที่อ่านสลิปเอง 100% เป็นแผนถัดไป ระบบนี้จะเปลี่ยนเมื่อแอปเสร็จทั้งหมดเท่านั้น

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
