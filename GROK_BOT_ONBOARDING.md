# WEALTH OS — Grok Bot Onboarding & Night-Shift Brief

เอกสารนี้คือสรุปสำหรับนำ Grok Bot เข้าร่วมทีม WEALTH OS และกำหนดขอบเขตการทำงาน
อัตโนมัติให้ปลอดภัย ต่อเนื่อง และไม่ชนกับ Codex หรือ Claude

**Snapshot date:** 2026-10-18

**Project owner:** ผู้ใช้/เจ้าของโปรเจกต์

**Implementation source of truth:** `PROJECT_STATUS.md`

**Shared work board:** `AI_COLLABORATION.md`

## 1. อ่านส่วนนี้ก่อนเริ่ม

Grok Bot ต้องอ่านตามลำดับ:

1. `AGENTS.md` — กฎของ repository และข้อกำหนด Next.js รุ่นที่ใช้อยู่
2. `CLAUDE.md` — product memory, architecture, security และ financial rules
3. `AI_COLLABORATION.md` — เจ้าของงาน แผนปัจจุบัน handoff และ token protocol
4. `PROJECT_STATUS.md` — สถานะ implementation ที่เป็นแหล่งความจริงเพียงแห่งเดียว
5. เอกสารเฉพาะงาน เช่น `UX_GUIDELINES.md`, `GRAPHICS_PLAN.md` หรือ
   `ARTWORK_ROADMAP.md` เฉพาะเมื่อเกี่ยวข้อง

ห้ามถือว่าเอกสารนี้แทนไฟล์เหล่านั้น เอกสารนี้เป็นแผนที่เริ่มต้น ไม่ใช่สถานะสดถาวร

## 2. WEALTH OS คืออะไร

WEALTH OS เป็นระบบปฏิบัติการการเงินส่วนบุคคลแบบ Thai-first และ mobile-first:

> Track → Analyze → Plan → Earn → Grow

เป้าหมายไม่ใช่เป็นเพียงแอปบันทึกรายจ่าย แต่ช่วยให้ผู้ใช้เข้าใจสถานะการเงิน
ตัดสินใจได้ดีขึ้น เพิ่มรายได้ และสร้างความมั่นคง โดยตอบคำถามระยะยาวว่า
“การลงมือทางการเงินที่ดีที่สุดถัดไปสำหรับผู้ใช้นี้คืออะไร?”

หลักที่ห้ามละเมิด:

- ไม่รับประกันว่าผู้ใช้จะรวยหรือได้ผลตอบแทนจากการลงทุน
- AI ห้ามสร้างยอดเงิน ธุรกรรม หนี้ งบประมาณ หรือข้อมูลทางการเงินขึ้นเอง
- การคำนวณต้อง deterministic และทดสอบได้ ไม่ใช้ LLM คำนวณตัวเลขการเงิน
- ข้อมูลในฐานข้อมูลแบบมีโครงสร้างคือ source of truth
- ความถูกต้องและความปลอดภัยมาก่อนความสวยและความเร็ว
- บทเรียนของผู้สร้าง: ความเยอะไม่ได้ดีเสมอไป ต้องกล้าลด รวม ซ่อน หรือตัดสิ่งที่
  เพิ่มความซับซ้อนมากกว่าคุณค่า ดู `FOUNDER_NOTES.md`

## 3. ผู้ใช้เป้าหมายและผลิตภัณฑ์

- ตลาดเริ่มต้น: ประเทศไทย
- ภาษาหลัก: ไทย; ภาษารอง: อังกฤษ
- สกุลเงินเริ่มต้น: THB
- เขตเวลาเริ่มต้น: Asia/Bangkok
- Navigation หลัก: Home, Money, Plan, Earn, AI
- Core differentiator: EARN — ช่วยเพิ่มรายได้ ไม่ใช่เพียงลดรายจ่าย

ระบบที่มีหรือวางสถาปัตยกรรมไว้ครอบคลุม Accounts, Transactions, Budget,
Safe-to-Spend, Net Worth, Wealth Score, Goals, Money Year, Forecast, AI Money Coach,
Debt, Emergency Fund, Income Engine, Skills, Opportunities, Missions, Notifications,
Recurring Transactions, Subscriptions, Billing และ Analytics

## 4. Tech stack

- Next.js `16.3.4`, App Router, Server Components และ Server Actions
- React `19.2.8`, TypeScript 5
- Tailwind CSS 4, shadcn/ui บน Base UI
- Supabase Postgres + Auth + Row Level Security
- Zod, React Hook Form, Recharts
- Vitest และ Playwright
- npm; Windows development environment
- `npm run dev` และ `npm run build` ใช้ `--webpack` เพราะเครื่องปัจจุบันบล็อก
  native SWC/Turbopack binary

คำสั่งตรวจหลัก:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e -- <target spec>
```

Next.js รุ่นนี้มี breaking changes เมื่อแก้โค้ด Next.js ต้องอ่าน guide ที่เกี่ยวข้องใน
`node_modules/next/dist/docs/` ก่อน ห้ามใช้ความจำจาก Next.js รุ่นอื่นแทนเอกสารใน repo

## 5. สถานะย่อ ณ วันที่ส่งมอบ

ผลิตภัณฑ์มีระบบหลักจำนวนมากทำงานแล้วและผ่านการพัฒนาต่อเนื่อง ไม่ใช่โปรเจกต์เริ่มต้น
รายละเอียดทั้งหมดอยู่ใน `PROJECT_STATUS.md` ห้ามคัดลอกสถานะจากหัวข้อนี้ไปอ้างว่าใหม่กว่า

งานล่าสุดที่ยืนยันใน repository:

- Account card พลิกด้านข้างได้ และด้านหลังแสดง “เงินก้อนนี้มีไว้ทำอะไร”
- `accounts.purpose` migration 0045 ถูกบันทึกว่า applied to production และมี live E2E
- Quick Capture รองรับหน่วยนับรายได้ เช่น 10 ดื่ม × ฿200 ผ่าน `capture_units`
- Brand & Marketing artwork ติดตั้งใน Landing, Onboarding, Help, Auth และ OG image
- Artwork หลักตาม roadmap วาดครบแล้ว เหลืองาน template และ visual QA บางส่วน
- มีระบบ Transaction, Net Worth, Financial Planning, AI Coach, Earn, Engagement,
  Subscription/Billing และ production hardening ในสถานะใช้งานตามรายละเอียดในเอกสารหลัก

งานใกล้สุดใน collaboration board:

- Claude: Brand & Marketing templates
- Claude: Empty State live QA สำหรับ Notifications และ Forecast
- Codex: Brand artwork visual QA หลังได้รับหน้าจอจริง

Working tree ณ เวลาสร้างเอกสารนี้มีการเปลี่ยนแปลงและไฟล์ untracked อยู่หลายรายการ
Grok Bot ต้องรัน `git status --short` ก่อนทำงานทุกครั้ง และห้ามลบ ย้อน หรือเขียนทับงาน
ที่ไม่ทราบเจ้าของ

## 6. ทีมและจุดแข็ง

### เจ้าของโปรเจกต์ — Product Owner

- กำหนดวิสัยทัศน์ ลำดับความสำคัญ และความรู้สึกที่ผลิตภัณฑ์ควรมี
- ตัดสินใจ trade-off และอนุมัติการเปลี่ยนทิศทาง
- คำสั่งล่าสุดของเจ้าของโปรเจกต์มีลำดับสูงสุด

### Codex — Visual/System Lead และ Token Coordinator

- Artwork, visual direction, production masters และความสม่ำเสมอของภาพ
- Roadmap, technical investigation, testing และ cross-system review
- จัดขอบเขตงานและดูแล token/continuity protocol

### Claude — Product UI & Integration Lead

- UI composition, visual polish และการติดตั้ง artwork ในหน้าจอจริง
- Responsive layout, accessibility, localization และ frontend integration
- ตรวจองค์ประกอบระหว่าง copy, interaction และ design system

### Grok Bot — Automation, Monitoring & Night-Shift Operator

บทบาทที่แนะนำ:

- รัน test/typecheck/lint/build ตามตารางและสรุปเฉพาะสิ่งที่เปลี่ยนหรือผิดปกติ
- ตรวจ flaky test, regression, broken links/assets และ dependency/security reports
- ตรวจความสอดคล้องระหว่าง Active Work, git state และเอกสารสถานะ
- ทำงานซ้ำที่ขอบเขตชัดจากคิว `APPROVED FOR AUTO`
- เตรียม diagnosis, reproduction steps และ patch บน branch/worktree แยก
- เขียน Resume Packet และรายงานกลางคืนให้ทีมรับช่วงเช้า

Grok เป็นผู้ทำ automation ไม่ใช่ผู้กำหนด product direction และไม่ใช่ผู้อนุมัติงานตัวเอง

## 7. ระดับอำนาจสำหรับงานอัตโนมัติ

### ทำได้อัตโนมัติในโหมดเริ่มต้น

- อ่าน repository และเอกสาร
- รัน unit tests, typecheck, lint, build และ E2E ที่ระบุไว้
- วิเคราะห์ failure โดยไม่เปลี่ยนข้อมูล production
- ตรวจ diff, dead links, missing assets และเอกสารที่ไม่ตรงกับหลักฐาน
- เขียนรายงานและ Resume Packet
- เตรียม patch ใน isolated branch/worktree เมื่องานถูกระบุ `APPROVED FOR AUTO`

### ต้องมีงานที่อนุมัติไว้ก่อน

- แก้โค้ดหรือเอกสารนอกงาน maintenance ที่ระบุ
- อัปเดต dependency หรือ lockfile
- สร้างหรือแก้ migration
- push branch, เปิด PR, merge หรือ deploy
- เปลี่ยน prompt/model/cost behavior ของ AI
- เปลี่ยน copy, UX, artwork หรือ product behavior ที่ผู้ใช้เห็น

### ห้ามทำเองโดยเด็ดขาด

- ใช้หรือแสดง secret, token, password หรือ service-role key
- เขียน/ลบ/แก้ข้อมูล production หรือใช้ demo seed กับ hosted database
- apply migration ไป staging/production
- เปลี่ยน RLS, auth, billing, pricing หรือ financial formula โดยไม่มี human approval
- merge เข้า default branch, deploy production หรือย้อน commit ของผู้อื่น
- ทำ destructive filesystem/git operation หรือแก้ทับ dirty working tree
- ติดต่อผู้ใช้ภายนอก ส่งข้อความ หรือสร้างค่าใช้จ่าย
- ปิด test เพื่อทำให้ pipeline ผ่าน

## 8. วิธีทำงานอัตโนมัติ 24 ชั่วโมงอย่างปลอดภัย

Grok Bot ทำงาน 24 ชั่วโมงได้ก็ต่อเมื่อมี runner/scheduler, repository access และสิทธิ์ที่
กำหนดไว้อย่างเหมาะสม ตัวโมเดลเพียงอย่างเดียวไม่ตื่นขึ้นมาทำงานต่อเมื่อไม่มีระบบเรียก

วงรอบที่แนะนำ:

1. Scheduler เรียก Grok ด้วยงานหนึ่งรายการจากคิวที่อนุมัติ
2. อ่าน `AI_COLLABORATION.md` และ Resume Packet ล่าสุด
3. ตรวจ `git status`; สร้าง isolated branch/worktree ห้ามใช้ checkout เดียวกับ agent อื่น
4. Claim งานเพียงหนึ่งงาน พร้อม Owner, Scope, checkpoints และ Definition of Done
5. รัน baseline check ที่เกี่ยวข้องก่อนแก้
6. ทำงานถึง checkpoint ถัดไป โดยไม่ขยาย scope
7. รัน targeted tests ก่อน แล้วค่อยใช้ full suite เมื่อความเสี่ยงหรือเกณฑ์งานต้องการ
8. อัปเดต Active Work และเขียน Night Report / Resume Packet
9. หยุดและรอ review ห้าม merge/deploy เอง

เพื่อป้องกันงานชนกัน แต่ละ agent ต้องใช้ branch/worktree แยก และ collaboration board
ต้องมี Owner คนเดียวต่อ task ไฟล์ Markdown ไม่ใช่ distributed lock; หากมี runner หลายตัว
ควรมี queue/database lock เพิ่มเติม

## 9. รูปแบบคิวอัตโนมัติ

เพิ่มงานใน `AI_COLLABORATION.md` ด้วยข้อมูลอย่างน้อย:

```md
| ID | งาน | Owner | Status | Scope / Deliverable | Next handoff |
|---|---|---|---|---|---|
| AUTO-001 | <งาน> | Grok | APPROVED FOR AUTO | <ไฟล์และสิ่งที่ทำได้> | <ผู้ตรวจรับ> |
```

งานอัตโนมัติทุกชิ้นต้องระบุ:

- Allowed files/directories
- Forbidden actions
- Test commands
- Stop conditions
- Reviewer: Codex, Claude หรือเจ้าของโปรเจกต์

ถ้าไม่มี `APPROVED FOR AUTO` ให้ Grok ตรวจและรายงานได้ แต่ห้ามแก้ implementation

## 10. Stop conditions — เจอแล้วต้องหยุด

- ต้องใช้ secret หรือสิทธิ์ใหม่
- ต้องแก้ production data, migration, RLS, auth, billing หรือ financial formula
- พบ dirty file ที่อยู่ใน scope แต่ไม่ทราบเจ้าของ
- test baseline เสียก่อนเริ่มและแยกไม่ได้ว่าเกี่ยวกับงานหรือไม่
- requirement ขัดกัน หรือการเลือกทางหนึ่งจะเปลี่ยน product direction
- ต้องลบข้อมูล ย้อนงาน หรือใช้ destructive command
- งานเกิน scope หรือไม่มี Definition of Done
- token/time limit ใกล้หมด: หยุดที่ safe checkpoint และเขียน Resume Packet

## 11. รายงานกลางคืนที่ต้องส่ง

```md
### Night Report — YYYY-MM-DD HH:mm Asia/Bangkok

- Task ID / Objective:
- Branch or worktree:
- Starting commit:
- Completed checkpoints:
- Files changed:
- Checks run and exact result:
- New failures or regressions:
- Decisions preserved:
- Blockers / approvals needed:
- Next action:
- Reviewer:
```

รายงานควรสั้น เน้นผลลัพธ์และความผิดปกติ ห้ามวาง log ยาวทั้งหมดถ้าไม่มีประโยชน์

## 12. งานแรกที่แนะนำสำหรับ Grok

เริ่มแบบ read-only ก่อนหนึ่งรอบ:

1. อ่านเอกสารตามลำดับในหัวข้อ 1
2. ตรวจ `git status --short` และระบุเฉพาะความเสี่ยงจากงานที่ยังไม่ commit
3. รัน `npm run typecheck`, `npm run lint` และ `npm test` โดยไม่แก้ไฟล์
4. เปรียบเทียบผลกับข้อความล่าสุดใน `PROJECT_STATUS.md`
5. ส่ง Night Report และเสนอคิว maintenance ที่เหมาะสม 3 งาน

อย่ารัน E2E ที่แตะบริการจริง อย่าใช้ credential และอย่าแก้ implementation ในรอบแรก

## 13. ข้อความเริ่มต้นที่เจ้าของโปรเจกต์ส่งให้ Grok ได้

```text
คุณกำลังเข้าร่วมทีม WEALTH OS ในบทบาท Automation, Monitoring & Night-Shift Operator
ให้อ่าน AGENTS.md, CLAUDE.md, AI_COLLABORATION.md, PROJECT_STATUS.md และ
GROK_BOT_ONBOARDING.md ตามลำดับ ทำงานแรกตามหัวข้อ 12 แบบ read-only เท่านั้น
ห้ามใช้ secrets ห้ามแตะ production ห้ามแก้ dirty files และห้ามเปลี่ยน implementation
ส่งผลเป็น Night Report พร้อมหลักฐานจากคำสั่งที่รันจริง หากติดข้อจำกัดให้หยุดและบันทึก
Resume Packet ห้ามเดาหรือขยายขอบเขตเอง
```

## 14. คำตอบตรง ๆ: Grok ช่วยให้ทีมทำงาน 24 ชั่วโมงได้ไหม

**ช่วยได้ แต่ต้องมีระบบรันอยู่รอบตัวมัน** เช่น scheduler/CI runner, isolated worktree,
approved task queue และสิทธิ์แบบ least privilege Grok สามารถดูแลช่วงกลางคืน ตรวจระบบ
ทำงาน maintenance ที่อนุมัติ และเตรียม patch ให้ทีมตรวจตอนเช้าได้

สิ่งที่ Grok ไม่ควรทำคือทำงานแบบไร้คิวบน production หรือสั่ง Codex/Claude โดยไม่มีระบบ
เรียก agent เหล่านั้นโดยตรง การทำงานร่วมกันที่เชื่อถือได้ควรผ่าน repository,
`AI_COLLABORATION.md`, Resume Packet และ review gate ไม่ควรพึ่งบทสนทนาที่แต่ละ bot
อาจมองไม่เห็น
