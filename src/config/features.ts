/**
 * Feature flags. Earn/AI are real product surfaces on the roadmap but have
 * no working implementation yet — per the execution spec, unfinished
 * features are hidden from navigation entirely rather than shown as
 * dead/fake buttons. Plan shipped in Day 2 (Goals, Emergency Fund).
 */
export const FEATURES = {
  plan: true,
  earn: false,
  ai: false,
} as const;
