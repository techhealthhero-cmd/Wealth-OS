import "server-only";

import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

import type { FinancialReportData } from "@/features/reports/queries";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { formatMoney, parseMoneyToCents } from "@/lib/financial/money";
import { calculateGoalProgress } from "@/lib/financial/goals";
import { calculateMonthsProtected } from "@/lib/financial/emergency-fund";

/**
 * Noto Sans Thai (SIL Open Font License), bundled locally rather than
 * fetched from Google Fonts at render time — @react-pdf/renderer's default
 * fonts (Helvetica etc.) have no Thai glyph coverage at all, so without
 * this every Thai character in the report would render as empty boxes.
 * Registered once per process; react-pdf caches by family name so repeat
 * calls across requests are cheap.
 */
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const fontsDir = path.join(process.cwd(), "src/features/reports/fonts");
  Font.register({
    family: "NotoSansThai",
    fonts: [
      { src: path.join(fontsDir, "NotoSansThai-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "NotoSansThai-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // react-pdf's default hyphenation/line-break engine assumes English word
  // morphology (breaks at arbitrary points based on English rules) — never
  // correct for Thai, which has no spaces between words and where breaking
  // mid-syllable can look wrong. A no-op callback ("never break this word")
  // is the safe default for a bilingual TH/EN report; long unbroken lines
  // may overflow their box instead, a visible layout issue rather than a
  // silent one. (Rendered output visually verified correct either way —
  // see the PDF-generation QA note in this feature's commit.)
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansThai", fontSize: 10, padding: 32, color: "#1a1a1a" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 2 },
  meta: { fontSize: 9, color: "#666666", marginBottom: 18 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 6, borderBottom: "1 solid #dddddd", paddingBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#555555" },
  value: { fontWeight: "bold" },
  bigValue: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottom: "0.5 solid #eeeeee" },
  itemName: { flex: 1 },
  itemMeta: { fontSize: 8, color: "#777777" },
  disclaimer: { fontSize: 8, color: "#888888", marginTop: 20, borderTop: "0.5 solid #dddddd", paddingTop: 8 },
});

function SectionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

/**
 * Pro-only PDF financial report (FEATURES.PDF_REPORT). Pure layout over
 * already-computed data from getFinancialReportData() — no new calculation
 * logic here, same "pure core, thin wrapper" rule as the rest of this
 * app's financial code (CLAUDE.md "FINANCIAL LOGIC").
 */
function FinancialReportDocument({ data, dict, locale }: { data: FinancialReportData; dict: Dictionary; locale: Locale }) {
  const r = dict.export.report;
  const generatedDate = new Date(data.generatedAt).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const monthsProtected = calculateMonthsProtected(
    data.emergencyFund ? parseMoneyToCents(data.emergencyFund.current_amount) : 0,
    data.essentialMonthlyExpensesCents
  );

  const debts = data.netWorth.liabilities.filter((l) => l.include_in_net_worth);
  const activeGoals = data.goals.filter((g) => g.status === "active");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>WEALTH OS — {r.title}</Text>
        <Text style={styles.meta}>
          {r.generatedOn} {generatedDate}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.netWorthSection}</Text>
          <Text style={styles.bigValue}>{formatMoney(data.netWorth.netWorthCents)}</Text>
          <SectionRow label={dict.netWorth.totalAssets} value={formatMoney(data.netWorth.totalAssetsCents)} />
          <SectionRow label={dict.netWorth.totalLiabilities} value={formatMoney(data.netWorth.totalLiabilitiesCents)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.wealthScoreSection}</Text>
          <Text style={styles.bigValue}>
            {data.wealthScore.result.totalScore} / 100
          </Text>
          <SectionRow label={dict.wealthScore.components.cashFlow} value={`${data.wealthScore.result.cashFlowScore}`} />
          <SectionRow label={dict.wealthScore.components.savings} value={`${data.wealthScore.result.savingsScore}`} />
          <SectionRow label={dict.wealthScore.components.emergencyFund} value={`${data.wealthScore.result.emergencyFundScore}`} />
          <SectionRow label={dict.wealthScore.components.debtHealth} value={`${data.wealthScore.result.debtHealthScore}`} />
          <SectionRow label={dict.wealthScore.components.netWorthGrowth} value={`${data.wealthScore.result.netWorthGrowthScore}`} />
          <SectionRow label={dict.wealthScore.components.incomeGrowth} value={`${data.wealthScore.result.incomeGrowthScore}`} />
          <SectionRow label={dict.wealthScore.components.goalProgress} value={`${data.wealthScore.result.goalProgressScore}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.cashFlowSection}</Text>
          <SectionRow label={r.income} value={formatMoney(data.summary.incomeCents)} />
          <SectionRow label={r.expenses} value={formatMoney(data.summary.expensesCents)} />
          <SectionRow label={r.cashFlow} value={formatMoney(data.summary.cashFlowCents)} />
          <SectionRow label={r.savingsRate} value={`${data.summary.savingsRatePercent.toFixed(1)}%`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.emergencyFundSection}</Text>
          <SectionRow
            label={dict.emergencyFund.current}
            value={formatMoney(data.emergencyFund ? parseMoneyToCents(data.emergencyFund.current_amount) : 0)}
          />
          <SectionRow label={dict.emergencyFund.monthsProtected} value={`${monthsProtected.toFixed(1)} ${dict.emergencyFund.months}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.debtSection}</Text>
          {debts.length === 0 ? (
            <Text style={styles.label}>{r.noDebt}</Text>
          ) : (
            debts.map((debt) => (
              <View key={debt.id} style={styles.itemRow}>
                <View style={styles.itemName}>
                  <Text>{debt.name}</Text>
                  <Text style={styles.itemMeta}>
                    {debt.interest_rate ? `${r.interestRate}: ${debt.interest_rate}%` : ""}
                    {debt.minimum_payment
                      ? `  ${r.minimumPayment}: ${formatMoney(parseMoneyToCents(debt.minimum_payment))}`
                      : ""}
                  </Text>
                </View>
                <Text style={styles.value}>{formatMoney(parseMoneyToCents(debt.balance))}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{r.goalsSection}</Text>
          {activeGoals.length === 0 ? (
            <Text style={styles.label}>{r.noGoals}</Text>
          ) : (
            activeGoals.map((goal) => {
              const percent = calculateGoalProgress(
                parseMoneyToCents(goal.current_amount),
                parseMoneyToCents(goal.target_amount)
              );
              return (
                <View key={goal.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>{goal.name}</Text>
                  <Text style={styles.value}>
                    {formatMoney(parseMoneyToCents(goal.current_amount))} / {formatMoney(parseMoneyToCents(goal.target_amount))} (
                    {percent.toFixed(0)}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {data.moneyYear ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {r.moneyYearSection} — {data.moneyYear.moneyYear.year}
            </Text>
            {data.moneyYear.metrics.map((metric) => (
              <View key={metric.key} style={styles.itemRow}>
                <Text style={styles.itemName}>{dict.moneyYear.metrics[metric.key]}</Text>
                <Text style={styles.value}>
                  {formatMoney(metric.progress.actualCents)} / {formatMoney(metric.progress.targetCents)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.disclaimer}>{r.disclaimer}</Text>
      </Page>
    </Document>
  );
}

export async function generateFinancialReportPdf(
  data: FinancialReportData,
  dict: Dictionary,
  locale: Locale
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<FinancialReportDocument data={data} dict={dict} locale={locale} />);
}
