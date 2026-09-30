import type { Metadata } from "next";

import { AccountPrivacyPlaceholder } from "@/features/account-privacy/components/account-privacy-placeholder";
import { getPrivacyGate } from "@/features/account-privacy/gate";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getStatementImportPreview } from "@/features/statement-import/actions";
import { StatementImportFlow } from "@/features/statement-import/components/statement-import-flow";

export const metadata: Metadata = { title: "Import statement — Wealth OS" };

interface StatementImportPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatementImportPage({ searchParams }: StatementImportPageProps) {
  const privacyGate = await getPrivacyGate(["accounts", "activity"]);
  if (privacyGate) return <AccountPrivacyPlaceholder {...privacyGate} section="generic" />;

  const params = await searchParams;
  const rawBatchId = params.batch;
  const batchId = Array.isArray(rawBatchId) ? rawBatchId[0] : rawBatchId;
  const [accounts, initialPreview] = await Promise.all([
    getDisplayAccounts(),
    batchId ? getStatementImportPreview(batchId) : Promise.resolve(null),
  ]);

  return (
    <StatementImportFlow
      accounts={accounts.map((account) => ({
        id: account.id,
        name: account.name,
        institution: account.institution,
        currencyCode: account.currency_code,
      }))}
      initialPreview={initialPreview}
    />
  );
}

