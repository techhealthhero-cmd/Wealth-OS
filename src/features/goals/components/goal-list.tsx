import { getGoals } from "@/features/goals/queries";
import { getAccounts } from "@/features/accounts/queries";
import { getProfile } from "@/features/profile/queries";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";
import { GoalForm } from "./goal-form";
import { GoalCard } from "./goal-card";
import { EmptyState } from "@/components/shared/empty-state";
import { GoalIllustration } from "@/components/illustrations";

export async function GoalList() {
  const [goals, accounts, profile] = await Promise.all([getGoals(), getAccounts(), getProfile()]);
  const locale = await getLocale(profile?.preferred_language);
  const dict = getDictionary(locale);

  if (goals.length === 0) {
    return (
      <EmptyState
        illustration={<GoalIllustration size={140} />}
        title={dict.goals.emptyTitle}
        description={dict.goals.emptyState}
        action={<GoalForm accounts={accounts} />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <GoalForm accounts={accounts} />
      </div>
      <div className="grid gap-3">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} accounts={accounts} />
        ))}
      </div>
    </div>
  );
}
