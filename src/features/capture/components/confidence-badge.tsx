"use client";

import { useTranslation } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { CaptureConfidence } from "@/types/database";

const TONE: Record<CaptureConfidence, string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

/** "High confidence / Worth a check / Needs review" pill for parsed or scanned captures. */
export function ConfidenceBadge({ confidence, className }: { confidence: CaptureConfidence; className?: string }) {
  const { t } = useTranslation();
  const label =
    confidence === "high"
      ? t("capture.confidenceHigh")
      : confidence === "medium"
        ? t("capture.confidenceMedium")
        : t("capture.confidenceLow");
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[confidence], className)}>
      {label}
    </span>
  );
}
