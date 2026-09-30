import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { getEarnHubData } from "@/features/earn/v2-queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { EarnIllustration } from "@/components/illustrations";
import { IncomePathCard } from "@/features/earn/components/v2/hub-cards";

export const metadata: Metadata = { title: "Earn — Wealth OS" };

export default async function IncomePathsPage() {
  const [data, profile] = await Promise.all([getEarnHubData(), getProfile()]);
  const dict = getDictionary(await getLocale(profile?.preferred_language));
  const v2 = dict.earn.v2;
  const paths = data.paths.filter((p) => p.path.status !== "archived");

  if (paths.length === 0) {
    return (
      <EmptyState
        illustration={<EarnIllustration size={140} />}
        title={v2.paths.title}
        description={v2.paths.empty}
        action={
          <Button nativeButton={false} render={<Link href="/earn/paths/new" />}>
            <Plus className="mr-1 size-4" aria-hidden="true" />
            {v2.paths.new}
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{v2.paths.title}</h2>
        <Button size="sm" className="h-10 rounded-xl" nativeButton={false} render={<Link href="/earn/paths/new" />}>
          <Plus className="mr-1 size-3.5" aria-hidden="true" />
          {v2.paths.new}
        </Button>
      </div>
      {paths.map((item) => (
        <IncomePathCard key={item.path.id} dict={dict} item={item} />
      ))}
    </div>
  );
}
