import { describe, expect, it } from "vitest";
import { normalizeSlipCategoryText } from "@/features/capture/lib/slip-category-text";
import { resolveSlip, slipSavePayloads } from "@/features/capture/lib/slip-auto-model";
import { classifySlipBatch } from "@/lib/slip/batch";
import type { ParseContext } from "@/lib/capture/transaction-parser";
const transport = "00000000-0000-4000-8000-000000000001";
const food = "00000000-0000-4000-8000-000000000002";
const ctx: ParseContext = {
  accounts: [], merchantPreferences: [], today: "2026-10-21",
  categories: [
    { id: transport, name_en: "Transport", name_th: "เดินทาง", type: "expense", is_archived: false, is_system: true, icon: null },
    { id: food, name_en: "Food & Dining", name_th: "อาหาร", type: "expense", is_archived: false, is_system: true, icon: null },
  ],
};
describe("slip-only Thai OCR category normalization", () => {
  it.each(["ปั๊มน้ามัน", "น ้ำมัน", "นํ้ามัน", "น้ํามัน", "ปัมน้ำมัน", "ปั้มน้ำมัน", "ป๊ัมน้ำมัน", "ปั๊มน้ำมัน", "ปั๊มแก๊ส", "ปั๊ม ปตท", "ปั๊มปตท", "ปั๊มบางจาก", "ปั๊มเชลล์", "ปั๊ม shell", "ปั๊มเอสโซ่", "ปั๊มคาลเท็กซ์", "ปั๊มพีที", "ปั๊ม PT", "ปั๊ม PTT", "ปั๊ ม น้ ำ มั น", "น้\u200Bำ\u200Dมัน", "PTT", "ปตท", "บางจาก", "Shell", "Caltex", "PT", "เติมน้ำมัน"])("categorizes %s as transport without changing party text", title => {
    const batch = classifySlipBatch([{ ocrText: `Amount: 100.25 THB\nDate: 20/10/2026\nSender: Someone\nReceiver: ${title}\nReference: ref`, perspective: "sender", ocrConfidence: 95 }]);
    const item = batch.items[0];
    const original = item.slip.receiver.name;
    expect(resolveSlip(item, {}, ctx)).toMatchObject({ categoryId: transport, title: original });
    expect(slipSavePayloads(batch, {}, ctx, transport)[0].categoryId).toBe(transport);
    expect(item.slip.receiver.name).toBe(original);
  });
  it.each(["ปั๊ม", "ปั้ม", "ปั๊มนม", "ปั้มนม", "ปั๊มน้ำ", "ปั๊มน้ำบาดาล", "ปั๊มลม", "ปั๊มจุ่ม", "ปั๊มหัวใจ", "ปั๊ ม น้ ำ", "ปั๊ม caption", "ปั๊ม empty", "ปั๊ม receipt"])("does not categorize non-fuel %s as transport", title => {
    const batch = classifySlipBatch([{ ocrText: `Amount: 100 THB\nDate: 20/10/2026\nSender: Someone\nReceiver: ${title}`, perspective: "sender", ocrConfidence: 95 }]);
    expect(resolveSlip(batch.items[0], {}, ctx).categoryId).not.toBe(transport);
  });
  it.each(["coffee", "น้ำ", "Salary", "ร้านอาหาร", "Unknown Merchant"])("preserves ordinary text %s", text => {
    expect(normalizeSlipCategoryText(text)).toBe(text);
  });
  it("keeps ordinary food in its existing category", () => {
    const batch = classifySlipBatch([{ ocrText: "Amount: 100 THB\nDate: 20/10/2026\nSender: Someone\nReceiver: coffee", perspective: "sender", ocrConfidence: 95 }]);
    expect(resolveSlip(batch.items[0], {}, ctx).categoryId).toBe(food);
  });
});
