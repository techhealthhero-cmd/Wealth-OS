import { canSaveDraft, type CaptureDraft } from "./draft";
import { evaluateCaptureConfidence } from "./confidence";
import { matchAccount, normalizeText, parseCaptureText, type ParseContext } from "./transaction-parser";
import type { MemoryObservation } from "./merchant-memory";

/** Called by explicit confirmation handlers after persistence succeeds, never by prediction. */
export function confirmedMemoryObservation(text: string, final: CaptureDraft, context: ParseContext): MemoryObservation | null {
  if (!canSaveDraft(final) || final.source === "receipt" || final.smart || !final.categoryId ||
    !context.categories.some(c => c.id === final.categoryId && !c.is_archived && (c.type === final.type || c.type === "both"))) return null;
  const parsed = parseCaptureText(text, context);
  const baseline = final.learningBaseline ?? parsed;
  const corrected = final.categoryConfirmedByUser || baseline.categoryId !== final.categoryId || baseline.type !== final.type;
  if (!corrected && final.categorySource === "fallback" && !final.categoryConfirmedByUser) return null;
  // A successful legacy save is not proof that conflicting amounts/dates were resolved.
  const gate = evaluateCaptureConfidence({ ...parsed, ...final }, { ...context, text });
  if (gate.reasons.some(r => ["foreign_currency", "missing_amount", "conflicting_amounts", "invalid_date", "unresolved_date", "emergency_account_unresolved", "subscription_account_unresolved"].includes(r))) return null;
  if (!corrected && !final.categoryConfirmedByUser && gate.reasons.some(r => r === "memory_conflict" || r === "ambiguous_direction")) return null;
  let keyText = normalizeText(text);
  let account = matchAccount(keyText, context.accounts);
  while (account?.span) {
    keyText = `${keyText.slice(0, account.span.start)} ${keyText.slice(account.span.end)}`.replace(/\s+/g, " ").trim();
    account = matchAccount(keyText, context.accounts);
  }
  return { text: keyText, categoryId: final.categoryId, direction: final.type, source: corrected ? "correction" : "confirm" };
}
