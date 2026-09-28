export const SKILL_LEVEL_THRESHOLDS = [0, 3, 8, 15, 25] as const;

export interface SkillProgress {
  level: number;
  progressPercent: number;
  completedWorkCount: number;
  nextLevel: number | null;
  workUntilNextLevel: number;
}

/**
 * Turns completed, skill-matched income missions into a compact game-style
 * level. The thresholds deliberately widen as the level grows so early wins
 * feel visible while higher levels still represent sustained practice.
 */
export function calculateSkillProgress(completedWorkCount: number): SkillProgress {
  const safeCount = Math.max(0, Math.floor(completedWorkCount));
  const currentIndex = SKILL_LEVEL_THRESHOLDS.findLastIndex((threshold) => safeCount >= threshold);
  const level = currentIndex + 1;
  const nextThreshold = SKILL_LEVEL_THRESHOLDS[currentIndex + 1];

  if (nextThreshold === undefined) {
    return {
      level,
      progressPercent: 100,
      completedWorkCount: safeCount,
      nextLevel: null,
      workUntilNextLevel: 0,
    };
  }

  const currentThreshold = SKILL_LEVEL_THRESHOLDS[currentIndex];
  const progressPercent = Math.round(
    ((safeCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  );

  return {
    level,
    progressPercent,
    completedWorkCount: safeCount,
    nextLevel: level + 1,
    workUntilNextLevel: nextThreshold - safeCount,
  };
}
