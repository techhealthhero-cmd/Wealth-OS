import { expect, it } from "vitest";
import fixture from "./fixtures/nlp/capture-corpus.v1.json";
import { parseCaptureText, normalizeText, type ParseContext } from "@/lib/capture/transaction-parser";
import { parseRecap } from "@/lib/capture/recap";
import { createConfidenceDraft, buildCaptureSaveInput, canSaveDraft } from "@/lib/capture/draft";
const ctx = fixture.context as ParseContext;
it.each([["ห้าสิบ",50],["สองพัน",2000],["หมื่นสอง",12000],["สามร้อยห้าสิบ",350],["2 พัน",2000],["25k",25000]] as const)("reads %s", (text, baht) => {
  expect(parseCaptureText(`ซื้อผัก ${text}บาท`, ctx).amountCents).toBe(baht*100);
});
it.each(["วันนี้", "เมื่อวาน", "เมื่อวานซืน"])("keeps a trailing date %s out of units", day => {
  const rows = parseRecap(`วิ่งแกร็บได้ 850 ${day}`, ctx);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({type:"income", amountCents:85000, unknownUnit:null});
  expect(rows[0].date).toBe(day === "วันนี้" ? ctx.today : day === "เมื่อวาน" ? "2026-10-18" : "2026-10-17");
});
it("keeps withholding in one gross income and persists tax/net in description", () => {
  const rows = parseRecap("ลูกค้าจ่ายค่าโลโก้ 15,000 หัก ณ ที่จ่าย 3%", ctx);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({type:"income",amountCents:1500000});
  const saved = buildCaptureSaveInput(createConfidenceDraft(rows[0], {...ctx,text:rows[0].sourceText}),"request");
  expect(saved?.description).toContain("หัก ณ ที่จ่าย 3% = 450 บาท สุทธิ 14550 บาท");
  expect(normalizeText(rows[0].sourceText)).toContain("ณ");
});
it.each([["ค่าผ่อนมอไซค์ 2,890 งวดที่ 5 จาก 36",289000,5,36,31],["ผ่อนไอโฟน 1,590 10 เดือน 0%",159000,null,10,null],["ผ่อนรถ 8,900",890000,null,null,null]] as const)("keeps existing installments saveable: %s", (text,amountCents,number,totalMonths,remainingMonths) => {
  const rows = parseRecap(text,ctx);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({type:"expense",amountCents,installment:{number,totalMonths,remainingMonths}});
  expect(canSaveDraft(createConfidenceDraft(rows[0],{...ctx,text}))).toBe(true);
  const saved = buildCaptureSaveInput(createConfidenceDraft(rows[0],{...ctx,text}),"request");
  if (number !== null) expect(saved?.description).toContain("งวดที่ 5 จาก 36");
  if (totalMonths === 10) expect(saved?.description).toContain("10 เดือน 0%");
  expect(rows[0].smart).toBeUndefined(); // Existing payments must never create a second asset/debt.
});
it.each(["รายได้ YouTube 18,400","ได้ YouTube 18,400","ลูกค้าโอน YouTube 18,400","สปอนเซอร์ YouTube 18,400"])("keeps income out of subscriptions: %s", text => {
  expect(parseCaptureText(text,ctx)).toMatchObject({type:"income",amountCents:1840000,subscription:null});
});
it.each(["Figma $15","Figma 15 ดอลลาร์","Figma 15 USD","Figma 15 EUR","Figma €15","Figma ¥15","Figma 15 JPY","Figma USD15","Figma 15 ดอลลาร์สหรัฐ"])("asks for baht: %s", text => {
  const draft=createConfidenceDraft(parseCaptureText(text,ctx),{...ctx,text});
  expect(draft.amountCents).toBeNull();
  expect(draft.confidenceGate).toMatchObject({autoSave:false,question:{reason:"foreign_currency",field:"amount"}});
  expect(draft.confidenceGate?.question?.promptTh).toContain("เงินบาท");
  expect(canSaveDraft(draft)).toBe(false);
});
it.each(["ลูกค้าจ่ายค่าโลโก้ 15,000 หัก ณ ที่จ่าย 3% ข้าว 50", "ค่าผ่อนมอไซค์ 2,890 งวดที่ 5 จาก 36 ข้าว 50", "ผ่อนไอโฟน 1,590 10 เดือน 0% ข้าว 50"])("attaches parameters before the next expense: %s", text => {
  const rows = parseRecap(text,ctx);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({type:"expense", amountCents:5000});
  expect(rows[1].sourceText).toBe("ข้าว 50");
});
it.each(["ค่าส่ง Flash", "ถุงไปรษณีย์", "ค่าตัดต่อ"])("uses the existing work cost category: %s", label => {
  const context: ParseContext = {...ctx,categories:[...ctx.categories,{id:"work",name_en:"Work Support",name_th:"ค่าใช้จ่ายทำงาน",type:"expense",is_system:true,icon:null}]};
  expect(parseCaptureText(`${label} 100`,context)).toMatchObject({type:"expense",categoryId:"work",amountCents:10000});
});

it.each(["พรุ่งนี้", "มะรืน", "วันก่อน", "อาทิตย์ก่อน", "สัปดาห์ก่อน", "เดือนก่อน"])("unresolved trailing date %s still leaves the amount intact", day => {
  const text = `วิ่งแกร็บได้ 850 ${day}`;
  const parsed = parseRecap(text,ctx);
  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({amountCents:85000,unknownUnit:null});
  expect(createConfidenceDraft(parsed[0],{...ctx,text}).confidenceGate?.autoSave).toBe(false);
});

it.each(["หก", "แสน", "หนึ่ง", "สองพัน"])("preserves label %s before a numeric price", word => {
  const text = `ซื้อร้าน ${word} 50`;
  expect(normalizeText(text)).toBe(text);
  expect(parseRecap(text, ctx)).toHaveLength(1);
  expect(parseRecap(text, ctx)[0].amountCents).toBe(5000);
});
it.each(["ซื้อตั๋วได้ 2 ใบ 500", "จ่ายได้ 3 งวด", "ผ่อนได้ 3 งวด"])("does not treat ability as income: %s", text => {
  expect(parseCaptureText(text, ctx).type).toBe("expense");
});
it.each(["ซื้อเยนตาโฟ 50", "ซื้อชาเยน 50", "ซื้อ Ke$ha 50"])("preserves baht in names: %s", text => {
  const parsed = parseCaptureText(text, ctx);
  expect(parsed.amountCents).toBe(5000);
  expect(createConfidenceDraft(parsed, {...ctx,text}).confidenceGate?.reasons).not.toContain("foreign_currency");
});
it.each(["ค่าเช่า 3 เดือน 9000", "ค่าเช่า 50% 9000", "ค่าเช่า 9000 เดือนละ"])("keeps the real amount beside parameters: %s", text => {
  const rows = parseRecap(text,ctx);
  expect(rows).toHaveLength(1);
  expect(rows[0].amountCents).toBe(900000);
});
it("does not turn a percentage into baht", () => {
  expect(parseCaptureText("50%",ctx).amountCents).toBeNull();
});

it("reads single spoken digits when explicitly priced in baht", () => {
  expect(parseCaptureText("ซื้อผัก หก บาท",ctx).amountCents).toBe(600);
});
