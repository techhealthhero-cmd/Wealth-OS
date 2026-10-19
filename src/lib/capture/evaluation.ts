import { evaluateCaptureConfidence, type ConfidenceContext, type ConfidenceField, type ReasonCode } from "./confidence";
import { parseCaptureText, type ParseContext } from "./transaction-parser";

export const EVALUATED_FIELDS = ["amountCents", "direction", "date", "accountId", "categoryId"] as const;
type Field = typeof EVALUATED_FIELDS[number];
type Value = string | number | null;
export interface CorpusItem {
  id: string;
  text: string;
  tags: string[];
  context?: Partial<ConfidenceContext>;
  expected: Partial<Record<Field, Value>> & {
    alternatives?: Partial<Record<Field, Value[]>>;
    autoSave: boolean;
    reasons: ReasonCode[];
    questionField: ConfidenceField | null;
  };
}
export interface CaptureCorpus { context: ParseContext; items: CorpusItem[] }
export function evaluateCorpus(corpus: CaptureCorpus) {
  const rows = corpus.items.map(item => {
    const context = { ...corpus.context, ...item.context, text: item.text };
    const parsed = parseCaptureText(item.text, context);
    const gate = evaluateCaptureConfidence(parsed, context);
    const actual = { ...parsed, direction: parsed.type };
    const correct = Object.fromEntries(EVALUATED_FIELDS.filter(f => f in item.expected).map(field => [field,
      [item.expected[field], ...(item.expected.alternatives?.[field] ?? [])].includes(actual[field]),
    ])) as Partial<Record<Field, boolean>>;
    const exact = Object.values(correct).every(Boolean);
    const financialCorrect = EVALUATED_FIELDS.filter(f => f !== "categoryId").every(f => correct[f] === true);
    const critical = gate.autoSave && (!financialCorrect || (!item.expected.autoSave && item.tags.some(t => t.startsWith("priority_"))));
    return { id: item.id, tags: item.tags, correct, exact, financialCorrect, autoSave: gate.autoSave, expectedAutoSave: item.expected.autoSave, critical,
      reasonsCorrect: item.expected.reasons.every(r => gate.reasons.includes(r)),
      questionCorrect: (gate.question?.field ?? null) === item.expected.questionField,
      reasons: gate.reasons, question: gate.question, actual: Object.fromEntries(EVALUATED_FIELDS.map(f => [f, actual[f]])) };
  });
  const summarize = (group: typeof rows) => {
    const ratio = (n: number, d: number) => d === 0 ? null : n / d;
    const saved = group.filter(r => r.autoSave);
    const uncertain = group.filter(r => !r.expectedAutoSave);
    return {
      count: group.length,
      perFieldAccuracy: Object.fromEntries(EVALUATED_FIELDS.map(field => [field, ratio(group.filter(r => r.correct[field]).length, group.filter(r => field in r.correct).length)])),
      exactMatch: ratio(group.filter(r => r.exact).length, group.length),
      autoSavePrecision: ratio(saved.filter(r => r.financialCorrect).length, saved.length),
      autoSaveCoverage: ratio(saved.length, group.length),
      clarificationRate: ratio(group.length - saved.length, group.length),
      uncertaintyRecall: ratio(uncertain.filter(r => !r.autoSave).length, uncertain.length),
      eligibilityAccuracy: ratio(group.filter(r => r.autoSave === r.expectedAutoSave).length, group.length),
      reasonRecall: ratio(group.filter(r => r.reasonsCorrect).length, group.length),
      questionAccuracy: ratio(group.filter(r => r.questionCorrect).length, group.length),
    };
  };
  return { ...summarize(rows), slices: Object.fromEntries([...new Set(rows.flatMap(r => r.tags))].sort().map(tag => [tag, summarize(rows.filter(r => r.tags.includes(tag)))])), criticalFailures: rows.filter(r => r.critical), rows };
}
