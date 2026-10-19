import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import baseline from "./fixtures/nlp/capture-baseline.v1.json";
import fixture from "./fixtures/nlp/capture-corpus.v1.json";
import { evaluateCorpus, type CaptureCorpus } from "@/lib/capture/evaluation";

it("evaluates the synthetic development corpus without unsafe automatic captures", () => {
  const report = evaluateCorpus(fixture as CaptureCorpus);
  if (process.env.NLP_REPORT_PATH) writeFileSync(process.env.NLP_REPORT_PATH, JSON.stringify({ ...report, rows: undefined }, null, 2) + "\n");
  expect(report.criticalFailures).toEqual([]);
  expect(report.autoSavePrecision).toBe(1);
});


it("preserves the measured baseline overall and in every slice", () => {
  const report = evaluateCorpus(fixture as CaptureCorpus);
  function assertBaseline(actual: typeof report.slices[string], expected: typeof report.slices[string]) {
    expect(actual.count).toBe(expected.count);
    for (const key of ["exactMatch", "autoSaveCoverage", "uncertaintyRecall", "eligibilityAccuracy", "reasonRecall", "questionAccuracy", "autoSavePrecision"] as const) {
      if (expected[key] !== null) expect(actual[key], key).toBeGreaterThanOrEqual(expected[key]!);
    }
    expect(actual.clarificationRate).toBeLessThanOrEqual(expected.clarificationRate!);
    for (const field of ["amountCents", "direction", "date", "accountId", "categoryId"] as const) {
      if (expected.perFieldAccuracy[field] !== null) expect(actual.perFieldAccuracy[field], field).toBeGreaterThanOrEqual(expected.perFieldAccuracy[field]!);
    }
  }
  assertBaseline(report, baseline);
  for (const [tag, expected] of Object.entries(baseline.slices)) assertBaseline(report.slices[tag], expected);
});

it("keeps independent labels, unique cases and at least 25 cases per priority slice", () => {
  expect(new Set(fixture.items.map(item => item.id)).size).toBe(fixture.items.length);
  expect(new Set(fixture.items.map(item => JSON.stringify([item.text, item.context]))).size).toBe(fixture.items.length);
  for (const tag of ["priority_emergency_unresolved", "priority_default_guess", "priority_invalid_date", "priority_amount_conflict", "priority_subscription_false_positive"]) {
    expect(fixture.items.filter(item => item.tags.includes(tag))).toHaveLength(30);
  }
});
