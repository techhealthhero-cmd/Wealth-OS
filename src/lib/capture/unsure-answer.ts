import type { CaptureDraft } from "./draft";
import type { Category } from "@/types/database";
import type { UnsureAnswer } from "./capture-device-store";
/** Only ordinary uncertain outgoing captures use these three choices; specialized flows keep their own questions. */
export function needsUnsureQuestion(draft: CaptureDraft, text: string): boolean {
  return draft.amountCents !== null && draft.amountCents > 0 && draft.type === "expense" && !draft.categoryConfirmedByUser && !draft.smart && !draft.subscription && !draft.cancelIntent && !draft.isEmergencyFundDraw &&
    (/โอน(?:เงิน)?\s*ให้/.test(text) || draft.confidence === "low" || draft.categorySource === "fallback");
}
export function applyUnsureAnswer(draft: CaptureDraft, answer: UnsureAnswer | null, categories: Category[]): CaptureDraft {
  if (!answer || draft.type !== "expense" || draft.smart || draft.subscription || draft.cancelIntent || draft.isEmergencyFundDraw || draft.categoryConfirmedByUser) return draft;
  // Lending remains in the existing review inbox: no invented receivable, liability or transfer.
  if (answer === "lend") return { ...draft, type: "expense", confidence: "low", categoryId: null, categorySource: "fallback", categoryConfirmedByUser: false, description: `ให้ยืม (ทวงคืนได้) · ${draft.description ?? draft.merchant ?? ""}`.slice(0, 200) };
  const category = answer === "wage" ? categories.find(c => (c.type === "expense" || c.type === "both") && /ค่าจ้าง|work support|freelance/i.test(`${c.name_th} ${c.name_en}`)) : categories.find(c => c.id === draft.categoryId);
  return { ...draft, type: "expense", confidence: category && (answer === "wage" || draft.categorySource !== "fallback") ? draft.confidence : "low", categoryId: category?.id ?? null, categoryConfirmedByUser: answer === "wage" && !!category, description: answer === "wage" ? `จ่ายค่าจ้างงาน · ${draft.description ?? draft.merchant ?? ""}`.slice(0, 200) : draft.description };
}
/** Explicit defer uses the server's existing needs_review rule. */
export function pendingUnsureDraft(draft: CaptureDraft): CaptureDraft {
  return { ...draft, confidence: "low", categoryConfirmedByUser: false };
}
