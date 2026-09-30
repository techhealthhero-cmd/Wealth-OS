import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEarnProjects, getIncomePath } from "@/features/earn/v2-queries";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { IncomeRecordForm } from "@/features/earn/components/v2/income-record-form";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function RecordEarnIncomePage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = await params;
  const path = await getIncomePath(pathId);
  if (!path) notFound();
  const [accounts, categories, projects, profile] = await Promise.all([
    // Privacy-safe rows: names only are passed to the client form.
    getDisplayAccounts(),
    getCategories("income"),
    getEarnProjects(path.id),
    getProfile(),
  ]);
  const locale = await getLocale(profile?.preferred_language);
  return (
    <IncomeRecordForm
      pathId={path.id}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: locale === "th" ? c.name_th : c.name_en }))}
      projects={projects.projects.map((p) => ({ id: p.id, name: p.title }))}
      today={todayInTimeZone(profile?.timezone ?? "Asia/Bangkok")}
    />
  );
}
