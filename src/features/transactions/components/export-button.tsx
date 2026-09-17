import Link from "next/link";
import { Download, Lock } from "lucide-react";

import { canUseFeature, FEATURES } from "@/lib/billing/entitlements";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { getProfile } from "@/features/profile/queries";
import { Button } from "@/components/ui/button";

/**
 * Pro-only CSV export trigger (see billing/plans.ts DATA_EXPORT). A plain
 * server-rendered link — no client JS needed, the browser's own download
 * handling covers the file save via the route's Content-Disposition header.
 * Never a dead button: an entitled user gets a real download link; a
 * non-entitled one gets a real link to /pricing (same "locked state links
 * to upgrade" pattern as LockedFeatureCard), never a disabled no-op.
 */
export async function ExportTransactionsButton() {
  const [profile, canExport] = await Promise.all([getProfile(), canUseFeature(FEATURES.DATA_EXPORT)]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (canExport) {
    return (
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<a href="/api/export/transactions" />}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {dict.export.exportCsv}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<Link href="/pricing" />}
      title={dict.export.lockedDescription}
    >
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      {dict.export.exportCsv}
    </Button>
  );
}
