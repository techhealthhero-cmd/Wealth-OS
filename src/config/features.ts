/**
 * Day-1 feature flags. Plan/Earn/AI are real product surfaces on the
 * roadmap but have no working implementation yet — per the execution spec,
 * unfinished features are hidden from navigation entirely rather than
 * shown as dead/fake buttons.
 */
export const FEATURES = {
  plan: false,
  earn: false,
  ai: false,
} as const;
