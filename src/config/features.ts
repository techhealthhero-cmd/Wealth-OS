/**
 * Feature flags. Earn is a real product surface on the roadmap but has no
 * working implementation yet — per the execution spec, unfinished features
 * are hidden from navigation entirely rather than shown as dead/fake
 * buttons. Plan shipped in Day 2 (Goals, Emergency Fund); AI shipped in Day 4
 * (Money Coach chat, Next Best Action, Monthly Health Check, Insights).
 */
export const FEATURES = {
  plan: true,
  earn: false,
  ai: true,
} as const;
