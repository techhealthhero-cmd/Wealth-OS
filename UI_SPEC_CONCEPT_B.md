# UI_SPEC_CONCEPT_B — Home Dashboard "Concept B" Reference Match

**เอกสารนี้คือแผนงาน ไม่ใช่การแก้โค้ด** เขียนขึ้นจากการวิเคราะห์ภาพ UI Reference (สกรีนช็อตแอปตัวอย่าง, ธีมเขียวเข้ม/ครีม) เทียบกับโค้ดจริงของ Wealth OS ที่ commit `f8e61b7` (2026-09) เป้าหมายคือให้ผู้ที่ implement ต่อ (Codex หรือ engineer อื่น) รู้ชัดเจนว่า: อะไรทำไปแล้ว, อะไรต้องทำต่อ, ข้อมูลแต่ละจุดมาจากไหนจริงๆ, และอะไรที่ **ห้ามใส่เป็นค่าจำลอง**

ไม่มีการแก้ Database schema, API, หรือ Business Logic ใน scope นี้ — ใช้ query/action/calculation ที่มีอยู่แล้วทั้งหมด

---

## 0. สถานะปัจจุบัน — ทำไปแล้วกับยังไม่ได้ทำ

รอบก่อนหน้า (commit `f8e61b7`) ได้ implement ส่วนใหญ่ของภาพ Reference นี้ไปแล้วจริง โดยใช้ข้อมูลจริงทั้งหมด ไม่มี mock:

| องค์ประกอบในภาพ | สถานะ | ไฟล์ |
|---|---|---|
| การ์ดมูลค่าสุทธิ (เขียวเข้ม) + ไอคอน info + popover อธิบาย | ✅ ทำแล้ว | `src/features/dashboard/components/net-worth-hero.tsx`, `net-worth-info-popover.tsx` |
| Badge "ดีขึ้น/แย่ลง ฿X จากเดือนก่อน" ทรงยาแคปซูล + ลูกศร | ✅ ทำแล้ว | `net-worth-hero.tsx` |
| กราฟเส้นแนวโน้ม 6 เดือน | ✅ มีอยู่ก่อนแล้ว (มี tooltip ที่แก้ให้สะอาดแล้วด้วย) | `net-worth-mini-chart.tsx` |
| การ์ดสินทรัพย์/หนี้สิน + แถบสัดส่วน 2 สี + % | ✅ ทำแล้ว | `net-worth-hero.tsx` (การ์ดที่ 2) |
| ปุ่ม รายรับ/รายจ่าย/โอนเงิน แบบเห็นชัด (ไม่ซ่อนใน dropdown) | ✅ ทำแล้ว (`variant="row"`) | `src/features/transactions/components/quick-add.tsx` |
| วงกลม "เดือนนี้" (คงเหลือตรงกลาง + รายรับ/รายจ่าย) | ✅ ทำแล้ว | `src/features/dashboard/components/charts.tsx` (`MonthlyDonutCard`) |
| กระดิ่งแจ้งเตือน + จุดแดง unread ที่หัว | ✅ ทำแล้ว | `src/components/layout/notification-bell.tsx` |
| Badge แผนสมาชิก "Plus" ที่หัว | ✅ ทำแล้ว (ย้ายมาจาก dashboard page ไปไว้ที่ header ทุกหน้า) | `src/components/layout/header.tsx` |
| "AI แนะนำวันนี้" | ✅ มีอยู่แล้ว (คนละชื่อ: `NextBestActionCard`) — ดูข้อ 6.1 สำหรับ gap ด้าน visual |
| "เป้าหมายใกล้สำเร็จ" | ✅ มีอยู่แล้ว (คนละชื่อ: `GoalProgressCard`) — ดูข้อ 6.2 สำหรับ gap ด้าน visual (แถบตรง ไม่ใช่วงแหวน) |

**สิ่งที่ยังไม่ได้ทำ / เป็น scope ของเอกสารนี้:**

1. ข้อความ tagline ข้างการ์ดมูลค่าสุทธิ ("ก้าวเล็กๆ สู่สุขภาพการเงินที่ดีขึ้น")
2. ตัวเลือกช่วงเวลา/เดือน ("ก.ย. 2569 ▾") บนการ์ดมูลค่าสุทธิ
3. ปรับ `GoalProgressCard` ให้เป็นวงแหวน (ring) แทนแถบตรง ให้เข้าชุดกับ `MonthlyDonutCard`
4. ปรับ `NextBestActionCard` ให้มีไอคอน sparkle ในชิปสีมิ้นท์ + ปุ่ม CTA ที่เด่นขึ้น (ปัจจุบันมีแค่จุดกลมเล็กๆ)

**สิ่งที่ตั้งใจไม่ทำตามภาพ (จากรอบก่อนหน้า ยังคงยืนยันจุดยืนเดิม):**

- ปุ่ม "สแกนสลิป" — ไม่มี OCR feature ในระบบจริง ใส่ไปจะเป็นปุ่มหลอก (dead button)
- เปลี่ยนแถบเมนูล่างจาก "หารายได้" เป็น "วิเคราะห์" — "หารายได้" คือจุดขายหลักของสินค้าตาม CLAUDE.md ("EARN... core differentiator") การตัดออกกระทบโครงสร้างสินค้า ไม่ใช่แค่ดีไซน์

---

## 1. วิเคราะห์ภาพ Reference

### Layout (บนลงล่าง)
1. Header: โลโก้ + "สวัสดี Dom" | กระดิ่ง | badge "Plus"
2. Hero Card (เขียวเข้ม เต็มความกว้าง, radius ใหญ่ ~24px): label + info icon, ตัวเลขใหญ่ (-฿75,671), ตัวเลือกเดือนมุมขวาบน, pill การเปลี่ยนแปลง, tagline มุมขวา, กราฟเส้น
3. การ์ดขาว: สินทรัพย์/หนี้สิน + แถบสัดส่วน
4. แถวปุ่ม 4 ช่อง (เราใช้ 3 — ไม่มีสแกนสลิป)
5. Section "เดือนนี้": วงแหวนโดนัท + รายรับ/รายจ่าย
6. การ์ด AI แนะนำ (ไอคอน sparkle มิ้นท์ + ปุ่ม primary)
7. การ์ด "เป้าหมายใกล้สำเร็จ" (วงแหวน % + ชื่อเป้าหมาย + ตัวเลข)
8. Bottom nav 5 ช่อง

### สี (อ้างอิงจาก globals.css v2.4 ที่มีอยู่แล้ว — **ไม่มีสีใหม่ที่ต้องเพิ่ม**)
ภาพ Reference นี้ตรงกับโทนสีที่ระบบมีอยู่แล้วเกือบ 100%:
- พื้นเขียวเข้มการ์ด Hero = `--primary` (`#1F4D3E`) — ตรงกับ `Card variant="highlight"` ที่มีอยู่แล้ว
- เขียวมิ้นท์ (badge, ไอคอนรายรับ, ครึ่งวงแหวนสินทรัพย์) = `#7FD6B2` (ใช้อยู่แล้วใน `net-worth-mini-chart.tsx`, `IconChip tone="mint"`)
- แดงชมพู (หนี้สิน, รายจ่าย) = Tailwind `rose-400`/`rose-500` (ใช้อยู่แล้วใน `IconChip tone="rose"` ที่เพิ่งเพิ่มรอบก่อน)
- พื้นขาว/ครีม = `--background` (`#F7F8F6`), การ์ดขาว = `--card` (`#FFFFFF`)

**สรุป: ไม่ต้องเพิ่ม Design Token สีใหม่เลย** — งานที่เหลือทั้งหมดใช้ token เดิม

### Typography / Spacing
- ตัวเลขหลัก (มูลค่าสุทธิ, คงเหลือ): `text-4xl font-bold` (มีอยู่แล้ว)
- Label รอง: `text-sm text-muted-foreground` / `text-xs text-primary-foreground/70` (บนพื้นเขียว)
- Card radius: `rounded-xl` (จาก `--radius-xl`, มีอยู่แล้วใน `Card` component)
- Card padding: `--card-spacing` (มีอยู่แล้ว, ใช้อัตโนมัติผ่าน `CardContent`)

### Responsive
ทุก component ที่ทำไปแล้วผ่านการทดสอบที่ 390px (iPhone) ด้วย Playwright จริงแล้ว (ดู commit message `f8e61b7`) — งานที่เหลือ (ข้อ 6) ต้องทดสอบที่ 320/375/390/430px เช่นเดียวกัน ตามมาตรฐานเดิมของโปรเจกต์

---

## 2. Component/ข้อมูลที่มีอยู่แล้วและนำกลับมาใช้ได้

| ต้องการ | ใช้ของเดิม |
|---|---|
| วงแหวน progress (%) | รูปแบบเดียวกับ `MonthlyDonutCard` — Recharts `<Pie>` + `innerRadius`/`outerRadius` + `startAngle={90}` `endAngle={-270}` (ดูตัวอย่างจริงใน `charts.tsx`) |
| ไอคอนชิปสีพาสเทล | `IconChip` (`src/components/shared/icon-chip.tsx`) — มี tone `mint`/`slate`/`lavender`/`rose` ครบแล้ว |
| การ์ดกดแล้วไปหน้าอื่นได้ + มี element กดแยกข้างในได้ (ไม่ชนกัน) | `ClickableCard` (`src/components/shared/clickable-card.tsx`) — ใช้ `data-stop-navigation` กับ element ที่ไม่ต้องการให้ trigger navigation |
| Popover อธิบายข้อมูล | `Popover`/`PopoverTrigger`/`PopoverContent` (`src/components/ui/popover.tsx`) |
| ตัวเลขวิ่ง count-up ตอนโหลด | `AnimatedNumber` (`src/components/shared/animated-number.tsx`) |
| Skeleton loading ระหว่างโหลด chart | `charts-lazy.tsx` มี pattern `next/dynamic({ssr:false})` อยู่แล้ว ใช้ต่อได้เลยสำหรับ chart ใหม่ |

---

## 3. ตาราง Mapping: จุดข้อมูลในภาพ ↔ แหล่งข้อมูลจริง

| จุดในภาพ | ค่าตัวอย่างในภาพ | แหล่งข้อมูลจริง | หมายเหตุ |
|---|---|---|---|
| ชื่อผู้ใช้ "Dom" | — | `profile.display_name` (`getProfile()`) | มีอยู่แล้ว |
| มูลค่าสุทธิ | -฿75,671 | `getNetWorthBreakdown().netWorthCents` | มีอยู่แล้ว |
| % เปลี่ยนแปลง | +12.4% | `calculateNetWorthChange()` (`src/lib/financial/net-worth.ts`) | มีอยู่แล้ว |
| สินทรัพย์/หนี้สิน | ฿278,129 / ฿353,800 | `breakdown.totalAssetsCents/totalLiabilitiesCents` | มีอยู่แล้ว |
| กราฟ 6 เดือน | — | `getNetWorthSnapshotsSince(6)` | มีอยู่แล้ว |
| "ก.ย. 2569" (ตัวเลือกเดือน) | — | **ดูข้อ 4.1 — มีข้อจำกัดข้อมูลจริง** | ต้องออกแบบใหม่ |
| Tagline "ก้าวเล็กๆ..." | — | **ไม่มีแหล่งข้อมูล — เป็น copy ตายตัว** | ดูข้อ 4.2 |
| คงเหลือเดือนนี้ | ฿13,500 | `getDashboardData().cashFlowCents` | มีอยู่แล้ว (ใช้ใน `MonthlyDonutCard` แล้ว) |
| รายรับ/รายจ่ายเดือนนี้ | ฿45,000 / ฿31,500 | `getDashboardData().incomeCents/expensesCents` | มีอยู่แล้ว |
| "ตั้งโอนอัตโนมัติ ฿3,000..." | — | `getFinancialPriority()` + `buildNextBestActionText()` (Priority Engine, deterministic) | มีอยู่แล้ว ผ่าน `NextBestActionCard` |
| เป้าหมาย 62% ฿186,000/฿300,000 | — | `getGoals()` + `calculateGoalProgress()` | มีอยู่แล้ว ผ่าน `GoalProgressCard` — แค่เปลี่ยน visual เป็นวงแหวน |

---

## 4. จุดที่ยังไม่มีข้อมูลจริงรองรับ — ห้าม Mock

### 4.1 ตัวเลือกเดือน ("ก.ย. 2569 ▾")

**วิเคราะห์ความเป็นไปได้จริง:** ตาราง `net_worth_snapshots` (ใช้โดย `getNetWorthSnapshotsSince`) เก็บแค่ยอดรวมมูลค่าสุทธิรายวัน/รายเดือน **ไม่ได้เก็บรายละเอียดสินทรัพย์/หนี้สินย้อนหลัง** — แปลว่าถ้าผู้ใช้เลือกดู "เดือนกรกฎาคม" ระบบสามารถโชว์ "มูลค่าสุทธิของเดือนนั้น" ได้จริง (จาก snapshot) แต่ **โชว์ breakdown สินทรัพย์/หนี้สินของเดือนนั้นแยกไม่ได้จริง** (การ์ดที่ 2 จะต้องโชว์ยอดปัจจุบันเสมอ ไม่ว่าจะเลือกเดือนไหน — ถ้าทำให้ดูเหมือนเปลี่ยนตามเดือนที่เลือกจะเป็นการหลอกผู้ใช้)

**ข้อเสนอ (เลือกอย่างใดอย่างหนึ่ง ให้ Product ตัดสินใจ ไม่ใช่ Codex เดา):**
- **แบบ A (แนะนำ, ทำได้เลยด้วยข้อมูลที่มี):** เปลี่ยนจาก "ตัวเลือกเดือน" เป็น "ตัวเลือกช่วงกราฟ" (1ด. / 6ด. / 1ปี / ทั้งหมด) แบบเดียวกับที่ระบุไว้ในสเปกก่อนหน้านี้ (PROJECT_STATUS) — ใช้ `getNetWorthSnapshotsSince(N)` เปลี่ยนค่า N ตามปุ่มที่กด ส่วนตัวเลขมูลค่าสุทธิหลักยังคงเป็น "ปัจจุบัน" เสมอ (ไม่เปลี่ยนตามช่วงกราฟ) — ไม่มีการหลอกข้อมูล
- **แบบ B (ต้องมี backend เพิ่ม, นอก scope รอบนี้):** ทำ "ดูมูลค่าสุทธิย้อนหลังแบบเต็ม" จริงๆ ต้องมี snapshot ที่เก็บ breakdown สินทรัพย์/หนี้สินราย item ด้วย ไม่ใช่แค่ยอดรวม — เป็นงาน schema-level ที่ต้องขออนุมัติแยก

**ต้องทำ:** ถามผู้ใช้/Product ว่าจะเอา A หรือ B ก่อน — **ห้าม Codex ใส่ dropdown ที่ผูกกับข้อมูลปลอม (เช่น สุ่มตัวเลขให้ดูเหมือนเปลี่ยนตามเดือน)**

### 4.2 Tagline "ก้าวเล็กๆ สู่สุขภาพการเงินที่ดีขึ้น"

ไม่มีฟิลด์ข้อมูลใดในระบบที่คำนวณข้อความนี้ — เป็น copy คงที่ (static), ไม่ใช่ผลลัพธ์จากการวิเคราะห์ข้อมูลผู้ใช้ **ไม่นับเป็น mock data ในความหมายที่ต้องห้าม** (มันไม่ได้แสร้งว่าเป็นตัวเลข/ผลคำนวณจากข้อมูลจริง เหมือน UI copy ทั่วไปในแอปที่มีอยู่แล้ว เช่น ข้อความ empty state) — ใส่เป็น i18n string ธรรมดาได้เลย **แต่ห้ามนำไปวางในตำแหน่งที่ทำให้ดูเหมือนเป็นผลวิเคราะห์เฉพาะบุคคล** (เช่น ห้ามใส่ใกล้ตัวเลขจนดูเหมือนเป็นคำอธิบายตัวเลขนั้น) — แนะนำใช้เป็น subtitle เบาๆ เท่านั้น

---

## 5. Design Tokens (อ้างอิงของเดิมทั้งหมด — ไม่มีของใหม่)

```
สี (globals.css, มีอยู่แล้ว):
  --primary: #1F4D3E        (การ์ด Hero, ปุ่มหลัก, active state)
  mint: #7FD6B2             (รายรับ, สินทรัพย์, บวก)
  rose: Tailwind rose-400/500/700 (รายจ่าย, หนี้สิน, ลบ)
  --background: #F7F8F6
  --card: #FFFFFF
  --muted-foreground: #6F7873

Radius:
  --radius-xl (การ์ดทั่วไป), --radius-2xl/3xl (ถ้าต้องการมนกว่าสำหรับ hero)

Motion (มีอยู่แล้วใน globals.css):
  --motion-fast/normal/slow/value/chart
  .motion-reveal-1 ถึง .motion-reveal-8 (stagger reveal, ต้องเพิ่ม -9 ถ้า section ใหม่ดันลำดับเกิน 8)

Component tone system:
  IconChip tone: "mint" | "slate" | "lavender" | "rose"
  Card variant: "default" | "soft" | "highlight"
```

---

## 6. สเปกรายชิ้นสำหรับส่วนที่เหลือ

### 6.1 NextBestActionCard — ปรับ visual ให้ตรงภาพมากขึ้น

**ไฟล์:** `src/features/ai/components/next-best-action-card.tsx`

- เปลี่ยนจุดกลมเล็ก (`motion-pulse-once size-1.5`) เป็น `IconChip icon={Sparkles} tone="mint"` วางซ้ายสุดของการ์ด (ดึงข้อมูล/logic เดิมทั้งหมด ไม่แตะ `buildNextBestActionText`)
- ปุ่ม CTA ("ดูรายละเอียด") ให้ลองใช้ `variant="default"` (ปุ่มทึบสีเขียว) แทน `variant="outline"` เพื่อให้เด่นแบบปุ่ม "ทำเลย" ในภาพ — **ต้องเช็ค UX_GUIDELINES.md ก่อนว่าการเปลี่ยน CTA hierarchy จุดนี้ขัดหลักการอื่นหรือไม่** (มีกฎเรื่อง CTA hierarchy ในเอกสารนั้น)
- ข้อความปุ่มอาจเปลี่ยนจาก "ดูรายละเอียด" (`nextBestAction.viewDetails`) เป็นคำกระตุ้นทำทันทีมากขึ้น เช่น "ทำเลย" — **ต้องเป็น i18n key ใหม่ ไม่ hardcode ข้อความ** และควรตรวจสอบว่าทุก priority type ที่ `cta` ชี้ไปนั้น "ทำเลย" ยังสมเหตุสมผล (บางอันอาจแค่ "ดูรายละเอียด" ก่อนค่อยทำจริง — ไม่ใช่ทุก CTA เป็น action ทันทีได้)

### 6.2 GoalProgressCard — แถบตรง → วงแหวน

**ไฟล์:** `src/features/dashboard/components/goal-progress-card.tsx`

- แทนที่ `<div className="h-2 w-full ...">...</div>` (แถบ progress แนวนอน) ด้วยวงแหวน Recharts `<Pie>` แบบเดียวกับ `MonthlyDonutCard` (data = `[{value: progress}, {value: 100-progress}]`, สี primary + muted)
- ตัวเลข % วางกลางวงแหวน (ใช้ `relative` + `absolute inset-0 flex items-center justify-center` เหมือน `MonthlyDonutCard`)
- **คงข้อมูล/logic เดิมทั้งหมด** (`calculateGoalProgress`, `calculateAmountRemaining`, `calculateGoalScheduleStatus`) — เปลี่ยนแค่การแสดงผล
- ต้อง lazy-load ผ่าน `charts-lazy.tsx` เช่นเดียวกับ chart อื่น (Recharts ไม่ควรอยู่ใน initial bundle)

### 6.3 Net Worth Hero — Tagline (ถ้า Product อนุมัติข้อ 4.2)

**ไฟล์:** `src/features/dashboard/components/net-worth-hero.tsx`, เพิ่ม i18n key `netWorth.tagline` ทั้ง `th.json`/`en.json`

- วางเป็น `<p className="text-xs text-primary-foreground/60">` มุมขวาบนของการ์ด (เฉพาะตอน `!isNegative`, เข้าธีม "highlight") — ตอน `isNegative` (พื้นขาว) ควรพิจารณาซ่อน หรือปรับสีให้เข้ากับพื้นขาว ไม่ใช่ copy ตรงมาเฉยๆ

### 6.4 Net Worth Hero — ตัวเลือกช่วงเวลา (รอ Product ตัดสินใจ A/B ตามข้อ 4.1)

ถ้าเลือกแบบ A: เพิ่ม state (client component ใหม่ คล้าย `NetWorthInfoPopover`) ครอบ `NetWorthMiniChart` พร้อมปุ่ม 4 ปุ่ม (1ด./6ด./1ปี/ทั้งหมด) เรียก `getNetWorthSnapshotsSince` ด้วยค่าต่างกัน — ต้องเป็น Server Action หรือ route handler ที่ re-fetch (ไม่ใช่ client-side คำนวณเอง เพราะข้อมูลอยู่ฝั่ง server)

---

## 7. Acceptance Criteria (ตรวจสอบได้จริง)

สำหรับทุกชิ้นในข้อ 6 ก่อน merge:

- [ ] `npx tsc --noEmit` ผ่าน ไม่มี error
- [ ] `npx eslint <ไฟล์ที่แก้>` ผ่าน ไม่มี error
- [ ] `npx vitest run` ผ่านทั้งหมด (ถ้าแก้ logic การคำนวณ ต้องมี test ใหม่ครอบ edge case)
- [ ] `npm run build` สำเร็จ
- [ ] ไม่มีค่าตัวเลข/ข้อความใดที่ hardcode แทนข้อมูลจริง (grep หาตัวเลขที่ดูเหมือนเงิน/เปอร์เซ็นต์ hardcode ในไฟล์ที่แก้)
- [ ] ทดสอบภาพจริงที่ 320px, 375px, 390px, 430px ด้วย Playwright (ตามมาตรฐานเดิมของโปรเจกต์ — ดู `tests/e2e/mobile-overflow.spec.ts`) ไม่มี horizontal overflow
- [ ] แถบเมนูล่างยังคงมี 5 รายการเดิม (หน้าแรก/การเงิน/วางแผน/หารายได้/AI) — ห้ามเปลี่ยน `NAV_ITEMS`
- [ ] ไม่มีปุ่มที่กดแล้วไม่ทำอะไร (dead button) — ทุกปุ่มต้องเชื่อมกับ action/route จริง
- [ ] ข้อความใหม่ทั้งหมดผ่าน i18n dictionary (`th.json`/`en.json`) ไม่ hardcode string ในไฟล์ component
- [ ] ไม่มีการแก้ไฟล์ใน `supabase/migrations/` และไม่มีการเปลี่ยน signature ของ query/action ที่มีอยู่ (เปลี่ยนได้เฉพาะ presentation layer)
- [ ] Component ใหม่ที่ใช้ Recharts ต้อง lazy-load ผ่าน `charts-lazy.tsx` เหมือนของเดิม (bundle size)
- [ ] Contrast/accessibility: ไอคอนที่กดได้ต้องมี `aria-label`, สีที่ใช้สื่อความหมาย (บวก/ลบ) ต้องมีข้อความกำกับด้วยเสมอ ไม่ใช่สีอย่างเดียว

---

## 8. ข้อห้าม / Constraints (ย้ำ)

- ห้ามแก้ `supabase/migrations/`, ห้ามเพิ่มคอลัมน์/ตารางใหม่
- ห้ามแก้ signature ของ query/action ใน `src/features/*/queries.ts`, `actions.ts` — เปลี่ยนได้เฉพาะ component ที่ render
- ห้ามใส่ตัวเลข/ข้อความที่ดูเหมือนคำนวณจากข้อมูลผู้ใช้จริงแต่จริงๆ เป็นค่าคงที่ (ยกเว้น copy ทั่วไปที่ระบุชัดในข้อ 4.2)
- ห้ามเปลี่ยนแถบเมนูล่างหรือโครงสร้าง Navigation หลัก
- ห้ามเพิ่มปุ่ม/ฟีเจอร์ที่ยังไม่มี backend รองรับจริง (เช่น สแกนสลิป)
- งานในข้อ 4.1 (ตัวเลือกเดือน) **ต้องได้รับการตัดสินใจจาก Product ก่อน** ว่าเอาแบบ A หรือ B — Codex ห้ามเดาเอง
