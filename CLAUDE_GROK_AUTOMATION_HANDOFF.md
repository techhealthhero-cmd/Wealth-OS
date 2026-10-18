# WEALTH OS — Claude Handoff: Build the Road for Grok Automation

**Date:** 2026-10-19

**Requested by:** Project owner

**Implementation owner:** Claude

**Reviewer:** Codex, then Grok read-only verification

**Shared board:** `AI_COLLABORATION.md`

## Objective

ทำให้ fresh clone ของ WEALTH OS มีเส้นทางตรวจคุณภาพที่ทำซ้ำได้ ปลอดภัย และไม่ต้องถือ
production secrets เพื่อให้ Grok Bot สามารถรัน nightly verification ได้อย่างน่าเชื่อถือ

ผลลัพธ์ปลายทางต้องเป็นคำสั่งที่ agent/CI ใช้ได้เหมือนกันทุกครั้ง พร้อม Node version ที่ชัดเจน
และไม่มีการเชื่อมต่อหรือเขียนข้อมูล production

## Evidence from Grok's first read-only run

- Unit tests ผ่าน `1023/1023`
- ESLint ผ่าน
- Fresh clone รัน `npm run typecheck` ไม่ผ่านเพราะยังไม่มี `.next/types`
- หลังรัน `npx next typegen` แล้ว typecheck ผ่าน `0 errors`
- Build หยุดเพราะไม่มี Supabase client environment variables
- `npm audit` รายงาน 16 findings รวม critical 2; ยังไม่ได้พิสูจน์ว่าเป็น runtime-reachable
- `AI_COLLABORATION.md` และ `GROK_BOT_ONBOARDING.md` ยังไม่อยู่บน remote main ตอนที่
  Grok ตรวจ รายการนี้จะถูกแก้ด้วย commit ที่เพิ่มเอกสารฉบับนี้

Codex ตรวจเพิ่มในเครื่องปัจจุบันแล้ว:

- Node ปัจจุบันคือ `v24.19.0`
- `@supabase/supabase-js@2.116.0` ระบุ engine เป็น Node `>=22.0.0`
- README ยังระบุ Node `20+`
- `package.json` ยังไม่มี `engines`
- `typecheck` ปัจจุบันคือ `tsc --noEmit`

## Guardrails

- อ่าน `AGENTS.md`, `CLAUDE.md`, `AI_COLLABORATION.md` และ
  `GROK_BOT_ONBOARDING.md` ก่อนลงมือ
- ก่อนแก้ Next.js config/scripts ให้อ่าน guide ที่เกี่ยวข้องใน `node_modules/next/dist/docs/`
- Working tree มีไฟล์แก้ไขและ untracked ของงานอื่น ห้ามลบ reset stage หรือแก้ทับ
- ห้ามใช้ production Supabase URL/key, service-role key, Stripe key หรือ AI key
- ห้าม apply migration, deploy, merge หรือเปลี่ยน production data
- ห้ามใช้ `npm audit fix --force`
- ทำงานบน branch/worktree แยกถ้าเป็นไปได้ และ commit เฉพาะไฟล์ใน scope

## Work plan

### AUTO-INFRA-01 — Make typecheck fresh-clone safe

เป้าหมาย: คำสั่ง typecheck หนึ่งคำสั่งต้องสร้าง Next.js route types ก่อนตรวจ TypeScript

งาน:

1. อ่าน Next.js 16 local docs สำหรับ `next typegen`
2. ปรับ scripts ให้ `npm run typecheck` ทำ type generation ก่อน `tsc --noEmit`
3. ถ้าเหมาะสม ให้มี script `typegen` แยกเพื่อใช้ใน CI และ debug
4. ทดสอบจากสภาพที่ไม่มี generated `.next/types` โดยไม่ลบข้อมูลผู้ใช้หรือไฟล์งานอื่น

Definition of Done:

- `npm run typecheck` ผ่านจาก fresh/generated-types-missing state
- รันซ้ำแล้วผ่านเหมือนเดิม
- ไม่ต้องรัน `next dev` หรือ `next build` ก่อน
- README/testing instructions ตรงกับคำสั่งจริง

### AUTO-INFRA-02 — Pin and document Node 22+

เป้าหมาย: local, CI และ bot ใช้ Node รุ่นที่ dependency รองรับตรงกัน

งาน:

1. เพิ่ม `engines.node` ใน `package.json` เป็นค่าที่สอดคล้องกับ Node `>=22`
2. เพิ่มไฟล์ version pin ที่ ecosystem ของ repo ใช้ได้ เช่น `.nvmrc` หรือ `.node-version`
3. แก้ README จาก Node 20+ เป็น Node 22+
4. หลีกเลี่ยงการบังคับ exact patch หากไม่มีเหตุผล ให้รองรับ Node 22 LTS และใหม่กว่า

Definition of Done:

- `npm install` ไม่แจ้ง engine mismatch บน Node 22+
- README, package metadata และ version pin ไม่ขัดกัน
- Node 24 ที่เครื่องปัจจุบันยังใช้งานได้

### AUTO-INFRA-03 — Add a safe bot build profile

เป้าหมาย: Grok/CI ตรวจ production build ได้โดยไม่ถือหรือแตะ production credentials

งาน:

1. ตรวจว่าระหว่าง `next build` มี route ใดเรียก Supabase network จริงหรือไม่
2. ออกแบบ build-only/test environment ที่มีเฉพาะค่าฝั่ง client แบบ dummy/non-production
3. ห้ามตั้ง service-role, Stripe, AI หรือ cron secrets
4. ทำให้ environment ระบุชัดว่าเป็น development/test ไม่ใช่ production backend
5. เพิ่มคำสั่งหรือเอกสารสำหรับ bot โดยไม่ commit `.env.local`

ค่าทดสอบต้องไม่ชี้ production และไม่ควรชี้ hosted project จริง หาก build จำเป็นต้องเชื่อม
network ให้หยุดและเสนอวิธี mock/architectural fix ก่อน ห้ามใส่ credential เพื่อให้ผ่าน

Definition of Done:

- Bot รัน build check ได้จาก fresh clone ตามเอกสาร
- ไม่มี secret อยู่ใน tracked files หรือ command output
- ไม่มี request หรือ write ไป production
- Build failure ยังสะท้อน code/config problem จริง ไม่ถูกกลบด้วยการปิด validation

### AUTO-SEC-01 — Triage npm audit; do not auto-fix

เป้าหมาย: แยกความเสี่ยงจริงออกจากจำนวน findings ก่อนเปลี่ยน dependency

สำหรับแต่ละ high/critical finding ให้บันทึก:

- package และ dependency path
- production dependency หรือ dev-only
- runtime reachable ใน WEALTH OS หรือไม่
- fixed version และมี breaking change หรือไม่
- patch ที่เล็กที่สุดและ tests ที่ต้องรัน

Definition of Done:

- มีรายงานสั้นที่ตัดสินใจได้ ไม่ใช่ raw audit dump
- ไม่มี dependency/lockfile change จนกว่าจะมีแผนอัปเดตและ reviewer
- ถ้ามี critical runtime-reachable ให้หยุดและยกระดับให้เจ้าของโปรเจกต์ก่อนงานอื่น

### AUTO-CLEAN-01 — Low-priority lint comment cleanup

ตรวจ `src/app/opengraph-image.tsx` ว่า `eslint-disable-next-line` ไม่ได้ใช้งานจริงหรือไม่
ลบเฉพาะเมื่อ lint ยืนยันว่า redundant งานนี้ทำหลัง AUTO-INFRA-01 ถึง 03 และ AUTO-SEC-01
เท่านั้น เพราะไม่ใช่ตัวขวาง automation

## Required verification

รันตามลำดับและบันทึกผลจริง:

```text
npm run typecheck
npm run lint
npm test
npm run build   # ใช้ safe bot build profile เท่านั้น
```

หากคำสั่งใดล้มเหลว ให้แยก baseline failure ออกจาก regression ที่เกิดจาก patch ห้ามแก้ไฟล์
นอก scope เพียงเพื่อให้ suite ผ่าน

## Deliverables back to the team

1. Patch/commit บน branch แยก
2. รายชื่อไฟล์ที่เปลี่ยน
3. คำสั่งตรวจและผลลัพธ์แบบ exact
4. Audit triage report
5. Handoff ใน `AI_COLLABORATION.md`
6. Resume Packet หากหยุดก่อนครบ

## Handoff sequence

1. Claude implement งาน infrastructure ตามลำดับด้านบน
2. Codex review ความปลอดภัย ขอบเขต และความสอดคล้องของ scripts/docs
3. Grok clone ใหม่และรัน read-only verification
4. หลังผ่านครบเท่านั้น จึงเพิ่ม nightly tasks เป็น `APPROVED FOR AUTO`

## First instruction to Claude

```text
อ่าน CLAUDE_GROK_AUTOMATION_HANDOFF.md และเอกสารที่มันอ้างถึงก่อน เริ่มจาก
AUTO-INFRA-01 และ AUTO-INFRA-02 เท่านั้น วางแผนก่อนแก้ ตรวจ dirty working tree และ
อย่าแตะไฟล์นอก scope เมื่อผ่าน Definition of Done ให้รายงานผลและขอ review ก่อนเริ่ม
AUTO-INFRA-03 ห้ามใช้ production credentials และห้ามรัน npm audit fix --force
```
