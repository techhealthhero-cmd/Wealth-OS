import { formatMoney } from "@/lib/financial/money";

/**
 * This month at a glance (2026-10-11, mockup "B + D"): income, spending,
 * what's left, and — only when a budget exists for the month — how much
 * of it is used. Every figure comes from the deterministic financial
 * functions; this component only lays them out.
 */
export function MonthSummary({
  title,
  showTitle = true,
  incomeCents,
  expenseCents,
  budget,
  labels,
}: {
  title: string;
  /** false when the wall calendar right below already names this month. */
  showTitle?: boolean;
  incomeCents: number;
  expenseCents: number;
  budget: { percentUsed: number; remainingCents: number } | null;
  labels: { income: string; expense: string; left: string; budgetUsed: string; budgetLeft: string; budgetOver: string };
}) {
  const left = incomeCents - expenseCents;
  const money = (cents: number) => formatMoney(cents, "THB", undefined, 0);
  const used = budget ? Math.max(0, Math.round(budget.percentUsed)) : 0;

  return (
    <section aria-label={title} className="space-y-2">
      {showTitle ? <h2 className="font-heading text-base font-semibold">{title}</h2> : null}
      <div className="rounded-2xl border bg-card p-3 shadow-card">
        <dl className="grid grid-cols-3 divide-x divide-dashed text-center">
          <div>
            <dt className="text-xs text-muted-foreground">{labels.income}</dt>
            <dd className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">+{money(incomeCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{labels.expense}</dt>
            <dd className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">−{money(expenseCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{labels.left}</dt>
            <dd className="font-semibold tabular-nums">{left < 0 ? `−${money(-left)}` : money(left)}</dd>
          </div>
        </dl>
        {budget ? (
          <div className="mt-3 space-y-1">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(used, 100)}
              aria-label={labels.budgetUsed.replace("{percent}", String(used))}
            >
              <div
                className={used > 100 ? "h-full rounded-full bg-rose-500" : "h-full rounded-full bg-amber-500"}
                style={{ width: `${Math.min(used, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{labels.budgetUsed.replace("{percent}", String(used))}</span>
              <span>
                {budget.remainingCents >= 0
                  ? labels.budgetLeft.replace("{amount}", money(budget.remainingCents))
                  : labels.budgetOver.replace("{amount}", money(-budget.remainingCents))}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
