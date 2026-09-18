# WEALTH OS — Autonomous Audit Report

**Date:** 2026-09-18
**Scope:** Full-repo audit → fix → test → re-verify pass (security, financial-calculation correctness, mobile responsiveness, performance, code hygiene).

## Status

All quality gates pass: `npx tsc --noEmit` clean, `npx eslint` clean on every changed file, **528/528** `vitest` tests pass (3 new regression tests added), `npm run build` succeeds cleanly (51 routes generated, no errors/warnings).

## Fixed — Security

1. **Server Action authorization gap**: `awardXpOnce` lived in a `"use server"` file, making it an unauthenticated-callable client Server Action despite trusting a caller-supplied `userId` with no independent check. Extracted to a plain `server-only` module (`src/features/engagement/xp.ts`); all legitimate call sites (which already verify `user.id` first) are unaffected.
2. **AI conversation/message IDOR**: `getConversation`, `getMessages`, and `touchConversation` accepted a client-supplied `conversationId`/id with no ownership check. Added a required `userId` parameter with `.eq("user_id", userId")` filtering to all three, and added an upstream ownership-verification gate in `src/app/api/ai/chat/route.ts` — an unowned or nonexistent conversation id from the client is now treated identically to "no id supplied" (a fresh conversation is created) instead of silently trusting it.
3. **Silent billing-webhook failure**: `checkout.session.completed` with missing `user_id` metadata or customer id previously no-op'd with zero observability. Now logs via `captureMessage` so a broken subscription link is actually debuggable.
4. Verified (no change needed): `debt_plan_priorities` RLS policies already correctly enforce cross-table ownership via an `exists (...)` subquery — a subagent's lower-confidence finding here was fact-checked against the migration SQL and confirmed already safe.

## Fixed — Financial Calculation Accuracy (P0)

1. **Month-end date overflow**: `calculateProjectedCompletionDate` (goals) and `calculateEmergencyFundCompletion` used unclamped `setMonth()` arithmetic — e.g. Jan 31 + 1 month silently overflowed to **March 3** instead of Feb 28, which could flip a goal's ahead/on-track/behind classification. Fixed by reusing the existing clamped month-adding helper (`addMonthsClamped`, exported from `recurring.ts`, previously only used for recurring-bill due dates).
2. **UTC-vs-local date parsing**: six call sites parsed a `"YYYY-MM-DD"` date-only string with a bare `new Date(...)`, which JavaScript interprets as UTC midnight — on any runtime whose local offset is behind UTC, this silently shifts the date back a day, capable of mis-bucketing an "overdue" bill or skewing a goal's schedule status. Fixed in `upcoming-bills.ts`, `goal-card.tsx`, `goal-progress-card.tsx`, `wealth-score/queries.ts`, `life-stage/queries.ts`, and `ai/tools/index.ts` by anchoring to local midnight (`${date}T00:00:00`), matching the convention already used elsewhere in the codebase.
3. **Debt-payoff simulation never terminated for an already-paid-off debt**: if every debt in a payoff plan already had a zero balance (e.g. a paid-off liability still on file), the simulation loop's guard was false immediately, so `totalMonths` and each debt's `payoffMonth` stayed `null` — read by callers as "never pays off," the opposite of the truth. Fixed in `debt-planner.ts`.

Added 3 regression tests (`tests/goals.test.ts`, `tests/emergency-fund.test.ts`, `tests/debt-planner.test.ts`) that fail against the pre-fix code and pass now.

Money representation (`money.ts`) was independently spot-checked and found solid: `parseMoneyToCents` throws on non-finite/malformed input rather than ever returning `NaN`, and every other financial-math file in `src/lib/financial/` was checked for zero/negative/divide-by-zero guards — all other denominators (savings rate, budget %, wealth score ratios, net-worth % change, income concentration) are already correctly guarded.

## Fixed — Mobile/Responsive

Two more instances of the previously-documented flex-overflow defect class (a variable-length text sibling next to a fixed-width sibling, missing `min-w-0`/`truncate`/`shrink-0`) found in older, not-recently-touched components:
- `money-year-view.tsx` — major expense row (long user-entered expense name could push the row past the viewport at 320-390px).
- `budget-view.tsx` — category budget row (category name + up to two badges + amount).

A broader spot-check of `subscriptions`, `income-sources`, `skills`, `notifications`, `billing`, `forecast`, and the shared `Dialog` primitive found those already correctly guarded or structurally safe (no regression from the earlier fix pass).

## Fixed — Performance

- `getAccounts()` was fetched independently (3×, uncached) by `getDashboardData()`, `getNetWorthBreakdown()`, and `getSafeToSpend()` on a single dashboard render — the exact anti-pattern `getProfile()` was already fixed for. Wrapped in React `cache()` to dedupe within one request.
- Confirmed correct and left unchanged: `getProfile()` caching (5 call sites → 1 query), `Promise.all` parallelization in `getDashboardData()`, and `NetWorthHero`'s sequential snapshot-write-then-read (a genuine dependency, not an N+1).

## Fixed — Code Quality / Observability

Routed 8 raw `console.error`/`console.warn` call sites through the established `captureError`/`captureMessage` observability abstraction instead of a parallel, uninstrumented logging path: `db-error.ts` (shared helper used at 18 call sites), `auth/actions.ts`, `auth/callback/route.ts` (×2, one of which previously logged the raw request URL), `profile/queries.ts` (×2), `config/env.ts`.

## Verified, No Issue Found

- Stripe webhook idempotency, plan-change handling, stale-event guarding, unmapped-subscription-status downgrade paths, and the test/live Stripe key mixing guard — all confirmed correct against the actual webhook logic.
- Accessibility spot-check (icon-only buttons, form labels, color-only status indicators, `<div onClick>` patterns, image alt text) across a representative sample — no gaps found; a full sweep of chart/SVG components and modal focus traps was not attempted (out of this pass's budget).

## Remaining External Blockers (not fixable from this session)

- **Google OAuth login on production** remains broken. Root cause was isolated in a prior session to Vercel's production `NEXT_PUBLIC_APP_URL` environment variable still pointing at `localhost:3000` (confirmed via the decoded Google OAuth `redirect_to` parameter). Fix requires the user to update it in the Vercel Dashboard and trigger a Redeploy (this is a `NEXT_PUBLIC_` var baked in at build time) — not something this session can do directly.

## Files Significantly Modified

Security/correctness: `src/features/engagement/xp.ts` (new), `src/features/engagement/actions.ts`, `src/features/monthly-review/actions.ts`, `src/features/ai/queries/index.ts`, `src/features/ai/actions/index.ts`, `src/app/api/ai/chat/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/features/accounts/queries.ts`.

Financial calculations: `src/lib/financial/goals.ts`, `emergency-fund.ts`, `recurring.ts`, `upcoming-bills.ts`, `debt-planner.ts`, `src/features/goals/components/goal-card.tsx`, `src/features/dashboard/components/goal-progress-card.tsx`, `src/features/wealth-score/queries.ts`, `src/features/life-stage/queries.ts`, `src/features/ai/tools/index.ts`.

Mobile: `src/features/money-year/components/money-year-view.tsx`, `src/features/budget/components/budget-view.tsx`.

Observability: `src/lib/db-error.ts`, `src/features/auth/actions.ts`, `src/app/auth/callback/route.ts`, `src/features/profile/queries.ts`, `src/config/env.ts`, `src/features/dashboard/components/{wealth-overview,net-worth-hero,goal-progress-card}.tsx`.

Tests: `tests/goals.test.ts`, `tests/emergency-fund.test.ts`, `tests/debt-planner.test.ts`.

i18n: `src/i18n/locales/{en,th}.json`, `src/app/(app)/help/page.tsx`.

## Important Notes

- No destructive git operations, no production data touched, no RLS disabled, no secrets committed.
- Every fix was verified against a concrete triggering scenario (real input values), not just static reasoning — per this session's established rigor standard.
- This pass did not attempt a full i18n-completeness sweep or a deep accessibility audit of chart/SVG components; both are reasonable candidates for a future focused pass if wanted.
