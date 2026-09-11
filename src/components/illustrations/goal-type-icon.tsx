export type GoalType =
  | "emergency_fund"
  | "travel"
  | "gadget"
  | "car"
  | "home"
  | "education"
  | "wedding"
  | "business"
  | "retirement"
  | "custom";

/**
 * Per-goal-type emoji, for the future Goals feature (GRAPHICS_PLAN.md P2 —
 * CLAUDE.md Phase 3, not built yet). Kept as one mapping + one component
 * rather than 10 separate SVG files, matching the same pattern already used
 * for category icons (`CATEGORY_ICON_EMOJI` in `src/lib/transaction-ui.ts`)
 * — easier to maintain and extend than a file per goal type. Not imported
 * anywhere yet; ready for whenever Goals ships.
 */
export const GOAL_TYPE_EMOJI: Record<GoalType, string> = {
  emergency_fund: "🛟",
  travel: "✈️",
  gadget: "📱",
  car: "🚗",
  home: "🏡",
  education: "🎓",
  wedding: "💍",
  business: "💼",
  retirement: "🌴",
  custom: "🎯",
};

interface GoalTypeIconProps {
  type: GoalType;
  size?: number;
  className?: string;
}

export function GoalTypeIcon({ type, size = 40, className }: GoalTypeIconProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: size * 0.55,
        borderRadius: "9999px",
        background: "var(--primary)",
      }}
    >
      {GOAL_TYPE_EMOJI[type]}
    </span>
  );
}
