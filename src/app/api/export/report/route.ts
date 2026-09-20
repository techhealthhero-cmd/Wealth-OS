import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getFinancialReportData } from "@/features/reports/queries";
import { generateFinancialReportPdf } from "@/features/reports/pdf-report";
import { requireFeature, FEATURES } from "@/lib/billing/entitlements";

/**
 * Pro-only PDF financial report (FEATURES.PDF_REPORT). Gated server-side
 * before any data fetch — identical ordering to the existing CSV export
 * (api/export/transactions/route.ts): auth check, then the feature gate,
 * then (and only then) the actual data work.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const profile = await getProfile();
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  const gate = await requireFeature(FEATURES.PDF_REPORT);
  if (!gate.allowed) {
    return Response.json({ error: dict.export.pdfLockedDescription }, { status: 403 });
  }

  const data = await getFinancialReportData();
  const pdf = await generateFinancialReportPdf(data, dict, locale);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wealth-os-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
