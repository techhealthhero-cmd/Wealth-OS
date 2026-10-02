/**
 * Thai Quick Capture AI eval — compares models on the two narrow capture
 * helpers, using the EXACT production prompts and validators:
 *   1. recap categories   (buildRecapCategoryPrompt + normalizeRecapCategoryOutput)
 *   2. sentence reading   (buildAIParseSystemPrompt + normalizeAIParseOutput)
 *
 * Calls the real Anthropic API with AI_API_KEY from .env.local (costs a few
 * baht per run). Not part of `npm test`; run with:
 *   npx vitest run --config vitest.eval.config.ts
 * Writes a JSON report to test-results/capture-ai-eval.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";

import { createAIProviderForModel, type AIProvider } from "@/features/ai/lib/provider";
import {
  buildAIParseSystemPrompt,
  buildRecapCategoryPrompt,
  normalizeAIParseOutput,
  normalizeRecapCategoryOutput,
  recapCategoryMaxTokens,
} from "@/lib/capture/ai-fallback";
import type { CaptureCategory } from "@/lib/capture/transaction-parser";

for (const line of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

// Override with EVAL_MODELS="model-a,model-b" to compare other candidates.
const MODELS = (process.env.EVAL_MODELS ?? `${process.env.AI_MODEL || "claude-sonnet-5"},claude-haiku-4-5-20251001`).split(",");
const TODAY = "2026-10-03";
const YESTERDAY = "2026-10-02";

// The seeded system categories (migration 0001), ids = English names for readable scoring.
const SEED: [string, string, "expense" | "income"][] = [
  ["อาหาร", "Food & Dining", "expense"], ["เดินทาง", "Transport", "expense"], ["ที่พัก", "Housing", "expense"],
  ["ช้อปปิ้ง", "Shopping", "expense"], ["สุขภาพ", "Health", "expense"], ["ความบันเทิง", "Entertainment", "expense"],
  ["การศึกษา", "Education", "expense"], ["ค่าสาธารณูปโภค", "Utilities", "expense"], ["สมาชิก/Subscription", "Subscriptions", "expense"],
  ["ประกัน", "Insurance", "expense"], ["ครอบครัว", "Family", "expense"], ["อื่นๆ", "Other", "expense"],
  ["เงินเดือน", "Salary", "income"], ["ฟรีแลนซ์", "Freelance", "income"], ["ธุรกิจ", "Business", "income"],
  ["โบนัส", "Bonus", "income"], ["คอมมิชชัน", "Commission", "income"], ["ดอกเบี้ย", "Interest", "income"],
  ["เงินคืน", "Cashback/Refund", "income"], ["อื่นๆ", "Other", "income"],
];
const CATEGORIES: CaptureCategory[] = SEED.map(([th, en, type]) => ({
  id: `${type}:${en}`,
  name_th: th,
  name_en: en,
  type,
  icon: null,
  is_system: true,
}));
const nameOf = (id: string | null | undefined) => (id ? id.split(":")[1] : null);

/** Items the deterministic rules can't place. `null` in `ok` = "no category" is also right. */
const CATEGORY_ITEMS: { text: string; type: "expense" | "income"; ok: (string | null)[] }[] = [
  { text: "ไก่ทอดหาดใหญ่", type: "expense", ok: ["Food & Dining"] },
  { text: "หมูปิ้งข้าวเหนียว", type: "expense", ok: ["Food & Dining"] },
  { text: "ข้าวมันไก่เจ๊ใหญ่", type: "expense", ok: ["Food & Dining"] },
  { text: "ชาไทยหน้าปากซอย", type: "expense", ok: ["Food & Dining"] },
  { text: "สุกี้ตี๋น้อย", type: "expense", ok: ["Food & Dining"] },
  { text: "ซื้อยาแก้ปวด", type: "expense", ok: ["Health"] },
  { text: "หาหมอฟัน", type: "expense", ok: ["Health"] },
  { text: "ค่าฟิตเนส", type: "expense", ok: ["Health", "Subscriptions"] },
  { text: "ค่าเทอมลูก", type: "expense", ok: ["Education", "Family"] },
  { text: "ค่าติวภาษาอังกฤษ", type: "expense", ok: ["Education"] },
  { text: "ค่าน้ำค่าไฟคอนโด", type: "expense", ok: ["Utilities", "Housing"] },
  { text: "เติมเงินมือถือ", type: "expense", ok: ["Utilities"] },
  { text: "ค่าเน็ตบ้าน AIS", type: "expense", ok: ["Utilities", "Subscriptions"] },
  { text: "YouTube Premium", type: "expense", ok: ["Subscriptions"] },
  { text: "iCloud 50GB", type: "expense", ok: ["Subscriptions"] },
  { text: "ค่าประกันรถยนต์", type: "expense", ok: ["Insurance"] },
  { text: "ให้เงินพ่อใช้", type: "expense", ok: ["Family"] },
  { text: "ค่านมผงลูก", type: "expense", ok: ["Family", "Shopping"] },
  { text: "ค่าวินมอไซต์หน้าหมู่บ้าน", type: "expense", ok: ["Transport"] },
  { text: "ค่าทางด่วนไปบางนา", type: "expense", ok: ["Transport"] },
  { text: "เติมแก๊สรถ", type: "expense", ok: ["Transport"] },
  { text: "ค่าอะไหล่มอไซค์", type: "expense", ok: ["Transport"] },
  { text: "ค่าหอเดือนนี้", type: "expense", ok: ["Housing"] },
  { text: "ค่าส่วนกลางคอนโด", type: "expense", ok: ["Housing"] },
  { text: "ซื้อรองเท้าวิ่ง", type: "expense", ok: ["Shopping", "Health"] },
  { text: "เสื้อยูนิโคล่", type: "expense", ok: ["Shopping"] },
  { text: "สั่งของ Shopee", type: "expense", ok: ["Shopping"] },
  { text: "คาราโอเกะกับเพื่อน", type: "expense", ok: ["Entertainment"] },
  { text: "ตั๋วคอนเสิร์ต", type: "expense", ok: ["Entertainment"] },
  { text: "ค่าเกม ROV", type: "expense", ok: ["Entertainment"] },
  { text: "เงินเดือนออก", type: "income", ok: ["Salary"] },
  { text: "รับจ้างออกแบบโลโก้", type: "income", ok: ["Freelance"] },
  { text: "ขายเสื้อมือสองออนไลน์", type: "income", ok: ["Business"] },
  { text: "โบนัสสิ้นปี", type: "income", ok: ["Bonus"] },
  { text: "ค่าคอมขายประกัน", type: "income", ok: ["Commission"] },
  { text: "ค่าดื่มโฮส", type: "income", ok: ["Commission", "Freelance"] },
  { text: "ทิปจากลูกค้า", type: "income", ok: ["Commission", "Freelance", null] },
  { text: "ดอกเบี้ยออมทรัพย์", type: "income", ok: ["Interest"] },
  { text: "Shopee คืนเงิน", type: "income", ok: ["Cashback/Refund"] },
  { text: "แม่ให้", type: "income", ok: [null] },
];

/** Messy sentences for the single-item reader. */
const SENTENCES: { text: string; amount: number; type: "expense" | "income"; category: (string | null)[]; date?: string }[] = [
  { text: "เมื่อคืนพาแฟนไปกินข้าวที่ร้าน Fuji จ่ายไป 1280 จากกสิกร", amount: 1280, type: "expense", category: ["Food & Dining"], date: YESTERDAY },
  { text: "เมื่อเช้าเติมน้ำมันรถไป 500 บาทที่ปั๊ม ptt", amount: 500, type: "expense", category: ["Transport"], date: TODAY },
  { text: "ซื้อของขวัญวันเกิดให้เพื่อนสนิทราคา 890", amount: 890, type: "expense", category: ["Shopping", "Family", null] },
  { text: "จ่ายค่าหมอคลินิกแถวบ้านไป 650 เพราะไม่สบาย", amount: 650, type: "expense", category: ["Health"] },
  { text: "ลูกค้าโอนค่าออกแบบเว็บมาให้ 7500 บาท", amount: 7500, type: "income", category: ["Freelance", "Business"] },
  { text: "วันก่อนซื้อหนังสือเตรียมสอบ TOEIC 450", amount: 450, type: "expense", category: ["Education"] },
  { text: "ได้ค่าคอมจากการขายรถเดือนนี้ 12000", amount: 12000, type: "income", category: ["Commission"] },
  { text: "สมัคร Spotify Family รายเดือน 289 ตัดบัตร", amount: 289, type: "expense", category: ["Subscriptions"] },
  { text: "เมื่อคืนไปดื่มกับเพื่อนหารกันคนละ 700", amount: 700, type: "expense", category: ["Entertainment", "Food & Dining"], date: YESTERDAY },
  { text: "ค่าน้ำประปาบ้านเดือนกันยา 230 บาท", amount: 230, type: "expense", category: ["Utilities"] },
];

interface ModelReport {
  model: string;
  categories: { correct: number; total: number; ms: number; inputTokens: number; outputTokens: number; misses: string[]; raw: string[] };
  sentences: { correct: number; total: number; ms: number; inputTokens: number; outputTokens: number; misses: string[] };
}

async function evalCategories(provider: AIProvider, report: ModelReport) {
  const system = buildRecapCategoryPrompt(CATEGORIES);
  for (let start = 0; start < CATEGORY_ITEMS.length; start += 20) {
    const batch = CATEGORY_ITEMS.slice(start, start + 20);
    const asked = batch.map((b) => ({ description: b.text, type: b.type }));
    const t0 = performance.now();
    const result = await provider.generate({
      system,
      maxTokens: recapCategoryMaxTokens(asked.length),
      thinking: "off",
      messages: [{ role: "user", content: JSON.stringify(asked.map((a, i) => ({ i, text: a.description, type: a.type }))) }],
    });
    report.categories.ms += performance.now() - t0;
    report.categories.inputTokens += result.usage.inputTokens;
    report.categories.outputTokens += result.usage.outputTokens;
    report.categories.raw.push(result.content);
    const picked = normalizeRecapCategoryOutput(result.content, asked, CATEGORIES);
    batch.forEach((item, i) => {
      const got = nameOf(picked[i]);
      report.categories.total += 1;
      if (item.ok.includes(got)) report.categories.correct += 1;
      else report.categories.misses.push(`${item.text} → ${got ?? "none"} (want ${item.ok.map((o) => o ?? "none").join("/")})`);
    });
  }
}

async function evalSentences(provider: AIProvider, report: ModelReport) {
  const system = buildAIParseSystemPrompt(TODAY, CATEGORIES);
  for (const s of SENTENCES) {
    const t0 = performance.now();
    const result = await provider.generate({ system, maxTokens: 300, thinking: "off", messages: [{ role: "user", content: s.text }] });
    report.sentences.ms += performance.now() - t0;
    report.sentences.inputTokens += result.usage.inputTokens;
    report.sentences.outputTokens += result.usage.outputTokens;
    const fields = normalizeAIParseOutput(result.content, { text: s.text, today: TODAY, categories: CATEGORIES });
    const problems: string[] = [];
    if (!fields) problems.push("unreadable");
    else {
      if (fields.amountCents !== s.amount * 100) problems.push(`amount ${fields.amountCents === null ? "none" : fields.amountCents / 100}`);
      if (fields.type && fields.type !== s.type) problems.push(`type ${fields.type}`);
      if (!s.category.includes(nameOf(fields.categoryId))) problems.push(`category ${nameOf(fields.categoryId) ?? "none"}`);
      if (s.date && fields.date !== s.date) problems.push(`date ${fields.date ?? "none"}`);
    }
    report.sentences.total += 1;
    if (problems.length === 0) report.sentences.correct += 1;
    else report.sentences.misses.push(`${s.text} → ${problems.join(", ")}`);
  }
}

describe("Thai capture AI eval", () => {
  it.skipIf(!process.env.AI_API_KEY)(
    "compares models on recap categories and sentence reading",
    async () => {
      const reports: ModelReport[] = [];
      for (const model of MODELS) {
        const provider = createAIProviderForModel(process.env.AI_API_KEY!, model);
        const report: ModelReport = {
          model,
          categories: { correct: 0, total: 0, ms: 0, inputTokens: 0, outputTokens: 0, misses: [], raw: [] },
          sentences: { correct: 0, total: 0, ms: 0, inputTokens: 0, outputTokens: 0, misses: [] },
        };
        await evalCategories(provider, report);
        await evalSentences(provider, report);
        reports.push(report);
      }

      for (const r of reports) {
        const pct = (c: number, t: number) => `${c}/${t} (${Math.round((c / t) * 100)}%)`;
        console.log(`\n=== ${r.model}`);
        console.log(`categories: ${pct(r.categories.correct, r.categories.total)} · ${Math.round(r.categories.ms)} ms total · tokens in/out ${r.categories.inputTokens}/${r.categories.outputTokens}`);
        console.log(`sentences:  ${pct(r.sentences.correct, r.sentences.total)} · ${Math.round(r.sentences.ms / r.sentences.total)} ms avg · tokens in/out ${r.sentences.inputTokens}/${r.sentences.outputTokens}`);
        for (const miss of [...r.categories.misses, ...r.sentences.misses]) console.log(`  ✗ ${miss}`);
      }
      mkdirSync("test-results", { recursive: true });
      writeFileSync("test-results/capture-ai-eval.json", JSON.stringify({ today: TODAY, reports }, null, 2));
    },
    300_000
  );
});
