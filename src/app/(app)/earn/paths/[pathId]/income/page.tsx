import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEarnProjects, getIncomePath } from "@/features/earn/v2-queries";
import { getDisplayAccounts } from "@/features/accounts/queries";
import { getCategories } from "@/features/categories/queries";
import { getProfile } from "@/features/profile/queries";
import { getLocale } from "@/i18n/server";
import { todayInTimeZone } from "@/lib/date";
import { z } from "zod";
import { IncomeRecordForm } from "@/features/earn/components/v2/income-record-form";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function RecordEarnIncomePage({ params }: { params: Promise<{ pathId: string }> }) {
  const { pathId } = await params;
  // Not a valid id → 404 up front (the queries below run in parallel and
  // would otherwise turn a malformed id into a database error).
  if (!z.string().uuid().safeParse(pathId).success) notFound();
  // The path's rows are keyed by the URL id, so they load with the path.
  const [path, accounts, categories, projects, profile] = await Promise.all([
    getIncomePath(pathId),
    // Privacy-safe rows: names only are passed to the client form.
    getDisplayAccounts(),
    getCategories("income"),
    getEarnProjects(pathId),
    getProfile(),
  ]);
  if (!path) notFound();
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
