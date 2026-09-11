export const FINANCIAL_STAGES = [
  "Survival",
  "Stable",
  "Protected",
  "Debt Controlled",
  "Investor",
  "Wealth Builder",
  "Financial Freedom",
] as const;

interface FinancialStageProgressProps {
  /** 1-indexed current stage (1 = Survival, 7 = Financial Freedom). */
  stage: number;
  size?: number;
  className?: string;
}

/**
 * For the future Net Worth / Financial Life Stage feature (GRAPHICS_PLAN.md
 * P2 — CLAUDE.md's 7-stage progression: Survival → Stable → Protected →
 * Debt Controlled → Investor → Wealth Builder → Financial Freedom). A plain
 * stepper — filled dots for stages reached, connected by a line — not a
 * game-like level bar, per the "never visually imply guaranteed wealth"
 * rule. Not imported anywhere yet.
 */
export function FinancialStageProgress({ stage, size = 280, className }: FinancialStageProgressProps) {
  const clampedStage = Math.min(Math.max(stage, 1), FINANCIAL_STAGES.length);
  const stepGap = (size - 24) / (FINANCIAL_STAGES.length - 1);

  return (
    <svg
      width={size}
      height={40}
      viewBox={`0 0 ${size} 40`}
      fill="none"
      role="img"
      aria-label={`Financial stage: ${FINANCIAL_STAGES[clampedStage - 1]}`}
      className={className}
    >
      <line
        x1="12"
        y1="20"
        x2={size - 12}
        y2="20"
        stroke="var(--border)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="20"
        x2={12 + stepGap * (clampedStage - 1)}
        y2="20"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {FINANCIAL_STAGES.map((label, index) => {
        const reached = index < clampedStage;
        const cx = 12 + stepGap * index;
        return (
          <circle
            key={label}
            cx={cx}
            cy="20"
            r={reached ? 7 : 5.5}
            fill={reached ? "var(--primary)" : "var(--background)"}
            stroke={reached ? "var(--primary)" : "var(--border)"}
            strokeWidth="2.5"
          />
        );
      })}
    </svg>
  );
}
