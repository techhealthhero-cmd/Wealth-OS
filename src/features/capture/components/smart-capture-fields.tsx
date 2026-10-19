"use client";
import { useTranslation } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/financial/money";
import { effectiveSmartIntent, type CaptureDraft } from "@/lib/capture/draft";

/** Minimal confirmation controls shared by text, recap and voice. */
export function SmartCaptureFields({ draft, onChange }: { draft: CaptureDraft; onChange: (patch: Partial<CaptureDraft>) => void }) {
  const { t } = useTranslation();
  const smart = effectiveSmartIntent(draft);
  if (!smart) return null;
  const plan = smart.plan;
  return <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
    {smart.kind === "asset_cash" && smart.assetDecision === "ask" ? <div>
      <p>{t("capture.smart.askAsset")}</p>
      <div className="flex gap-2">{[true, false].map((yes) => <Button key={String(yes)} type="button" size="sm" variant="outline" aria-pressed={draft.smartAssetAccepted === yes} onClick={() => onChange({ smartAssetAccepted: yes })}>{t(yes ? "capture.smart.yes" : "capture.smart.no")}</Button>)}</div>
    </div> : null}
    {smart.kind !== "loan" && draft.smartAssetAccepted !== false ? <p>{t("capture.smart.asset")}: {smart.assetName} · {formatMoney(smart.priceCents)}</p> : null}
    {smart.kind === "loan" ? <div className="space-y-2">
      <p>{smart.ratePeriodNeedsConfirm ? t("capture.smart.confirmPeriod") : t("capture.smart.ratePeriod")}</p>
      <div className="flex gap-2">{(["month", "year"] as const).map((period) => <Button key={period} type="button" size="sm" variant="outline"
        aria-pressed={(draft.smartRatePeriod ?? smart.ratePeriod ?? smart.suggestedRatePeriod) === period}
        onClick={() => onChange({ smartRatePeriod: period })}>{t(`capture.smart.${period}`)}</Button>)}</div>
    </div> : null}
    {smart.kind !== "asset_cash" ? <>
      <p>{t("capture.smart.liability")}: {formatMoney(smart.principalCents)}</p>
      {smart.rateMissing ? <p className="text-muted-foreground">{t("capture.smart.rateMissing")}</p> : null}
      {smart.ratePeriodAssumed ? <p className="text-muted-foreground">{t("capture.smart.yearAssumed")}</p> : null}
      {plan ? <dl className="grid grid-cols-2 gap-1 tabular-nums">
        <dt>{t("capture.smart.monthly")}</dt><dd>{formatMoney(plan.monthlyPaymentCents)} × {plan.termMonths}</dd>
        {smart.kind === "loan" ? <><dt>{t("capture.smart.interestOnly")}</dt><dd>{formatMoney(plan.interestOnlyMonthlyCents)}</dd></> : null}
        <dt>{t("capture.smart.totalInterest")}</dt><dd>{formatMoney(plan.totalInterestCents)}</dd>
        <dt>{t("capture.smart.totalPaid")}</dt><dd>{formatMoney(plan.totalPaidCents)}</dd>
        <dt>{t("capture.smart.firstDue")}</dt><dd>{plan.firstDueDate}</dd>
        <dt>{t("capture.smart.finalPayment")}</dt><dd>{formatMoney(plan.schedule.at(-1)!.paymentCents)}</dd>
      </dl> : null}
      {smart.termAssumed ? <p className="text-muted-foreground">{t("capture.smart.termAssumed")}</p> : null}
      {smart.aboveLegalCap ? <p className="text-amber-700 dark:text-amber-400">{t("capture.smart.highInterest")}</p> : null}
    </> : null}
    <p className="text-xs text-muted-foreground">{t("capture.smart.estimate")}</p>
  </div>;
}
