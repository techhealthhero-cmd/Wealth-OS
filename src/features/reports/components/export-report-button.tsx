import Link from "next/link";
import { FileText, Lock } from "lucide-react";

import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Button } from "@/components/ui/button";

/**
 * Pro-only PDF report export trigger (FEATURES.PDF_REPORT) — same shape as
 * ExportTransactionsButton (transactions/components/export-button.tsx),
 * next to which this renders: a plain server-rendered link, no client JS,
 * the browser's own download handling covers the file save via the
 * route's Content-Disposition header. Never a dead button: entitled ->
 * real download link; not entitled -> real link to /pricing.
 */
export async function ExportReportButton() {
  const [profile, canExport] = await Promise.all([getProfile(), canUseFeature(FEATURES.PDF_REPORT)]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (canExport) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/export/report" />}>
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        {dict.export.exportPdf}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<Link href="/pricing" />}
      title={dict.export.pdfLockedDescription}
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      {dict.export.exportPdf}
    </Button>
  );
}
