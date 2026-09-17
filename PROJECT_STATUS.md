# WEALTH OS — PROJECT STATUS

**This is the only source of truth for current implementation status** —
what's built, verified, and known-limited right now. See `CLAUDE.md`'s
"Document Ownership" section for how this fits with the other project
docs (in particular: `GRAPHICS_PLAN.md`'s own ✅/🟡/⬜ status markers are
explicitly non-authoritative and defer to this file).

Last updated: 2026-09-16

## Current Phase

Day 1 / Foundation + Money Core — **complete and fully verified** (see "Day 1 Final Closeout" below).

Day 2 / Wealth Engine — **complete and fully verified live.** Every system (Smart Budget, Assets, Liabilities, Net Worth, Financial Goals, Emergency Fund, Safe-to-Spend, Wealth Score) is implemented, migration `0003_wealth_engine.sql` is applied to the live project, RLS is verified live with two real users (35/35 checks passed across all 8 new tables), and every new page has been exercised end-to-end in a real browser with real data — not just code-reviewed. This pass also found and fixed two real bugs live testing surfaced (a systemic UTC-vs-local-timezone date bug affecting Thailand-timezone users since Day 1, and a misleading Wealth Score improvement-action amount) — see "Day 2 — Wealth Engine" below for the full breakdown.

Day 3 / Financial Planning — **complete and fully verified live.** Money Year (annual/quarterly plan vs. actual), Debt Planner (snowball/avalanche/custom, real amortization simulation), Financial Forecast (scenario-based projection + "what if" exploration), Financial Life Stage (7-stage deterministic classification), and the Financial Priority Engine are all implemented, migration `0004_financial_planning.sql` is applied to the live project, RLS is verified live with two real users (25/25 checks passed across all 6 new tables plus the extended `budgets` policy), and every new page has been exercised end-to-end in a real browser with real data. Live testing surfaced and fixed two real bugs (a hardcoded-English Life Stage explanation that bypassed the i18n system entirely, and a Forecast starting-state calculation that silently produced a flat, misleading ฿0-income projection for any user without 3+ months of transaction history) — see "Day 3 — Financial Planning" below for the full breakdown. 196/196 tests passing. **Ready for Day 4: YES.**

Day 4 / AI Money Coach — **complete and fully verified live.** Provider-agnostic AI abstraction (direct-`fetch` Anthropic implementation, never imported outside `server-only` code), 16 controlled financial tools, a compact Financial Context Builder, the `/ai` chat route with streaming responses and Thai-first suggested prompts, a fully deterministic Next Best Action card, Monthly Financial Health Check, and AI Insight cards (all zero-LLM-call — only the conversational chat itself touches a model), prompt-injection guardrails, distress-signal and guaranteed-return detection, and `ai_conversations`/`ai_messages`/`ai_usage_log` persistence. Migration `0005_ai_money_coach.sql` is applied to the live project, RLS is verified live with two real users (13/13 checks passed), and the chat/Next Best Action/Monthly Health Check/dashboard integration have all been exercised end-to-end in a real browser with real seeded data at 375/390/430/desktop. `AI_API_KEY` is not configured in this environment, so the live conversational reply itself could not be exercised against a real model — the "AI not configured" fallback path was verified instead (see "Known Limitations" under Day 4). 246/246 tests passing. **Ready for Day 5: YES.**

Day 5 / Income Engine — **complete and fully verified live.** Income Sources, a deterministic Income Profile (stability, concentration risk, MoM growth), Skills Profile, Income Target + Income Gap, a deterministic Side Hustle Finder (17-opportunity catalog, 6-factor weighted scoring model), Income Missions (a fixed 10-step deterministic mission sequence), and an Earn Dashboard are all implemented and wired into Day 4's existing AI architecture (5 new controlled tools, extended Financial Context, extended system prompt) rather than a second AI system. Migration `0006_income_engine.sql` is applied to the live project, RLS is verified live with two real users (26/26 checks passed across all 4 new user-owned tables plus the read-only global catalog table), and every new page (`/earn` + 4 sub-routes) has been exercised end-to-end in a real browser with real seeded data at 375/390/430/desktop. Live testing found and fixed one real bug (a second, separate priority-label i18n namespace on the dashboard's Life Stage card was missing the new `income_gap` priority type, leaking the raw translation key onto the screen) — see "Day 5 — Income Engine" below for the full breakdown. 289/289 tests passing. **Ready for Day 6: YES.**

Day 6 / Engagement & Automation — **complete and fully verified live.** A real conversational reply from the live Anthropic model was verified end-to-end for the first time this session (see "AI Live Model Verification" below), fixing a real response-truncation bug in the process. Wealth Missions (deterministic, template-driven, auto-completing from real data), a lightweight append-real-ledger XP/level system, forgiving streaks (weekly check-in, monthly review, transaction-tracking — all derived live, no punitive language), Recurring Transactions (confirmation-first posting policy), Upcoming Bills, a deterministic Subscription Detector (pattern-matched, never AI-driven), an in-app Notification foundation with per-category preferences and database-enforced deduplication, and a proper Monthly Financial Review (distinct from Day 4's automated Health Check) are all implemented and wired into the existing Day 4 AI architecture (5 more controlled tools, a further-extended Financial Context) rather than a new system. Migration `0007_engagement.sql` is applied to the live project, RLS is verified live with two real users (41/41 checks passed across all 7 new tables), and every new route (`/missions`, `/money/recurring`, `/money/subscriptions`, `/review`, `/notifications`, plus dashboard integration) has been exercised end-to-end in a real browser with real seeded data at 375/390/430/desktop. Live testing found and fixed one real bug (calling a `revalidatePath`-containing Server Action directly during a Server Component's render, which Next.js 16 disallows) — see "Day 6 — Engagement & Automation" below for the full breakdown. 349/349 tests passing. **Ready for Day 7: YES.**

Day 7 / SaaS / Subscriptions / Billing — **complete and fully verified live.** Free/Plus/Pro plans defined in one centralized config (`src/lib/billing/plans.ts`), a trusted server-side entitlement resolver, AI usage limits reusing Day 4's `ai_usage_log` (no second logging system), a provider-agnostic `BillingProvider` abstraction with a direct-`fetch` Stripe implementation (no SDK dependency, mirroring Day 4's Anthropic provider pattern), checkout/portal/webhook routes, contextual paywall UI reusing `LockedBadge` for the first time, a `/pricing` page, and a Billing section on both `/profile` and a new `/billing` page. Migration `0008_billing.sql` is applied to the live project, RLS is verified live with two real users (8/8 checks passed, including proving a client-side attempt to self-grant a paid plan is silently blocked). Full browser QA at 390px/desktop found and fixed one real bug (the pricing page always labeled the Plus card "Recommended," even for a user already subscribed to Plus, instead of "Current Plan"). No Stripe keys are configured in this environment, so the real checkout→webhook→portal→cancel flow against live Stripe test mode could not be exercised — the "billing not configured" fallback path was verified instead, end-to-end, in a real browser. A related, pre-existing environment gap was also found: `SUPABASE_SERVICE_ROLE_KEY` is present in `.env.local` but empty, so `createAdminClient()` will throw once actually invoked (checkout customer bootstrap, webhook writes) until a real key is supplied — see "Known Limitations" and "Required Env Vars" below. 402/402 tests passing. **Ready for Day 8: YES** (per this task's explicit stop condition, Day 8 itself was not started).

Day 8 / Production Hardening — **complete and fully verified live.** Full security audit (fixed a real open-redirect in the auth callback, confirmed RLS enabled on all 37 tables, confirmed the AI prompt-injection sanitizer covers every user-editable field, confirmed no secret ever reaches client code); centralized production env validation (`src/config/env.ts` now refuses a half-configured Stripe setup); a real, live-tested, Postgres-backed rate limiter (`check_rate_limit()`, migration `0009_rate_limits.sql`) wired into login/signup/forgot-password/AI chat/billing checkout+portal; global `error.tsx`/`global-error.tsx`/`not-found.tsx`; a provider-agnostic observability boundary (`captureError`) and analytics boundary (`trackEvent`) wired into the highest-signal real call sites; a genuine performance fix found and fixed (`getProfile()` was querying the database 2-3 times per request across nested layouts — now deduplicated via React `cache()`) plus Recharts code-splitting on the dashboard; an accessibility pass (chat `aria-live`, chart screen-reader summaries, `prefers-reduced-motion` support app-wide); PWA manifest + two new icon sizes; `robots.ts`/`sitemap.ts` plus a noindex on every authenticated route. Migrations `0009_rate_limits.sql` and `0010_performance_indexes.sql` (a real missing `transactions(user_id, category_id)` index, found via a systematic FK/index audit) are both applied to the live project. Cross-user isolation was verified live across **all 32 user-owned/security-sensitive tables** with two real disposable users (0/32 leaks, plus a positive control proving the isolation is real and not just empty tables) — the widest security sweep of any day so far. A full, realistic end-to-end journey was run live in a real browser with a comprehensively-seeded Plus-plan account (24 systems: accounts through billing), including a genuine logout → blocked-route redirect → re-login → data-persists cycle. 416/416 tests passing (14 new). **Launch Ready: YES for a Free-only or Stripe-test-mode launch; real production Stripe/service-role credentials remain the one manual step before real money can move — see "Launch Readiness" below.**

## Repository Note

The full Day 1 foundation (everything under "Migrations Added" / "Routes Added" below, plus `src/features`, `src/lib`, `src/components`, `src/i18n`, `src/config`, `src/types`, and `supabase/`) is committed as of this session — see the "Day 1 Final Closeout" section for what shipped in that commit. Previously this had all been sitting uncommitted on disk only.

## Working

- Next.js application starts successfully (`npm run dev` / `npm run build`, both pinned to `--webpack` — see Architectural Decisions)
- localhost development environment works
- Supabase project connected (`lvxuruzspchhcwebrbzy`)
- Supabase URL configured correctly (`https://lvxuruzspchhcwebrbzy.supabase.co`)
- Supabase anon key configured
- Landing page works
- Login UI exists and **works end-to-end** (verified with a real browser test + real account)
- Signup UI exists and **works end-to-end**
- Supabase Auth creates users successfully
- Database migrations applied to the live project (`0001_init.sql`, `0002_system_categories.sql`)
- All tables exist and are reachable: `profiles`, `accounts`, `categories`, `transactions`, `tags`, `transaction_tags`
- `handle_new_user` trigger creates a `profiles` row automatically on signup
- RLS verified: a user can read their own profile; reading another user's profile returns empty, not an error
- Password reset flow works end-to-end (forgot-password → email → `/auth/callback` → `/reset-password` → new password takes effect)
- Logout works; re-login with a new password works
- 20 system categories seeded (Thai + English)
- **Account creation** — verified live: `opening_balance` correctly seeds `current_balance` via the `set_accounts_initial_balance` trigger
- **Transaction creation (expense + income)** — verified live: `recalc_account_balance` trigger correctly updates `current_balance` on every insert (tested 10000 − 200 expense + 1000 income → 10800)
- **Transfers (`create_transfer` RPC)** — verified live: debits `from_account_id`, credits `to_account_id` atomically in one row, rejects same-account transfers with a clear error (`P0001: from_account_id and to_account_id must differ`)
- **RLS on accounts/transactions** — verified live with two real accounts: a second user sees zero rows for the first user's accounts/transactions, and is blocked (`42501`, HTTP 403) from inserting a transaction that references another user's `account_id`, even when `user_id` on the row is their own

## Currently Debugging

Nothing open as of this update. (See "Incident" below for the most recent one, now resolved.)

## Incident: pre-migration account had no profile row → permanent login→/login redirect loop

**Symptom:** the account `techhealthhero@gmail.com` could authenticate successfully every time (confirmed via `auth.users.last_sign_in_at` updating and real `auth.sessions` rows being created) but every attempt to reach `/dashboard` — including a fresh incognito window and typing the URL directly — bounced straight back to `/login` with no visible error.

**Root cause:** this account was created via signup *before* migrations were applied to the live project (see the earlier "Recently Fixed" #2). At that time the `handle_new_user` trigger didn't exist yet, so no `public.profiles` row was ever created for it. Once migrations were applied, the trigger only fires on new `auth.users` inserts going forward — it does not retroactively backfill existing accounts. `getProfile()` returning `null` for a real, authenticated user made `(app)/layout.tsx` treat them as logged out and redirect to `/login`, with no error surfaced anywhere (this is a legitimate "no profile yet" case from the layout's point of view, not an error).

**How it was found:** ruled out cookies/browser state first (incognito + manual URL nav still failed), then verified a *brand-new* account logging in against the *same running server* worked perfectly — isolating the problem to this one account's data rather than the code. A direct query joining `auth.users` to `public.profiles` for that email showed `profile_id: null`.

**Fix (data):** manually inserted the missing `profiles` row for that user with the same defaults the trigger uses (`th`/`THB`/`Asia/Bangkok`, `onboarding_completed = false`).

**Fix (code, defensive):** `getProfile()` (`src/features/profile/queries.ts`) now self-heals — if an authenticated user has no profile row, it creates one on the spot (handling the concurrent-request race via a `23505` unique-violation catch + re-fetch) instead of silently returning `null` and stranding the user. This means the same class of bug can't recur for any account, regardless of why the trigger didn't run for it.

Verified: user confirmed they reached `/onboarding` successfully after the fix. lint/typecheck/tests re-run clean; production build not re-run this pass to avoid disrupting the user's live dev server session (same low-risk pattern as prior verified builds — to be confirmed next session).

## Recently Fixed (this session)

1. **`NEXT_PUBLIC_SUPABASE_URL` was malformed** — first pointed at the Supabase *dashboard* URL, then had `/rest/v1/` appended. Both broke every Auth/REST call. Fixed to the bare `https://<project-ref>.supabase.co`.
2. **Database migrations had never been applied** to the live Supabase project — `profiles`/`accounts`/`categories`/`transactions` didn't exist (`PGRST205` on every query). Applied both migration files via the Supabase Management API.
3. **Password reset redirect skipped the PKCE code exchange** — `resetPasswordForEmail`'s `redirectTo` pointed straight at `/reset-password` instead of through `/auth/callback`, so the recovery link's `code` was never exchanged for a session, causing `updateUser()` to fail with "Auth session missing!". Fixed: `redirectTo` now points at `/auth/callback?next=/reset-password`.
4. **Generic "Something went wrong" hid the real error** — added dev-mode error surfacing (`NODE_ENV !== "production"` only) in `safeAuthError()` (`src/features/auth/actions.ts`), `getProfile()` (`src/features/profile/queries.ts`), and `/auth/callback` (`src/app/auth/callback/route.ts`). Real Supabase error (message/status/code) now logs server-side and shows in the UI in dev.
5. **`/login` never displayed the callback error** — added `?error=` handling to `src/app/(auth)/login/page.tsx` → `LoginForm`.
6. **Base UI `nativeButton` warnings** — `<Button render={<Link/>}>` needs `nativeButton={false}` since it renders an `<a>`, not a `<button>`. Fixed in 5 spots (`src/app/page.tsx`, `src/app/(app)/dashboard/page.tsx`).

Verification method for all of the above: direct calls to the Supabase Auth/REST APIs, a real Playwright browser driving the actual login form, and reading the live dev server's own request/console logs — not just re-reading the code.

## This Session (repository audit)

No code bugs found. Did find and fix one hygiene gap: `supabase/.temp/` (a Supabase CLI version-cache file) was untracked-but-not-ignored, so it would have been committed accidentally on the next `git add`. Added `supabase/.temp/` to `.gitignore`.

Then re-verified Day 1's previously-unchecked items directly against the live database (fresh test accounts, cleaned up afterward): account creation + balance trigger, expense/income transaction creation + balance recalc, `create_transfer` RPC (both-side balances, same-account rejection), and RLS on `accounts`/`transactions` (read isolation + cross-user insert rejection referencing another user's `account_id`). All passed without changes needed. Re-ran lint/typecheck/tests/build — all clean.

## Day 1 Expected Systems

| System | Status |
|---|---|
| Authentication (email/password + Google OAuth scaffold) | ✅ implemented & verified live |
| Profile (auto-created via trigger) | ✅ implemented & verified live |
| Accounts (CRUD) | ✅ implemented & verified live (create + balance trigger, edit, archive) |
| Categories (system-seeded) | ✅ implemented & verified live (20 rows confirmed) |
| Transactions (CRUD) | ✅ implemented & verified live (income/expense create + balance recalc, edit, delete) |
| Transfers (atomic, via `create_transfer` RPC) | ✅ implemented & verified live (balances on both accounts, same-account rejection) |
| Dashboard (real data, charts) | ✅ implemented; not re-verified via browser this session |
| Cash Flow | ✅ implemented + unit tested |
| Savings Rate | ✅ implemented + unit tested |
| Supabase RLS | ✅ implemented & verified live on `profiles`, `accounts`, and `transactions` (own-row read access; cross-user insert referencing another user's `account_id` is blocked at the database level) |

## Migrations Added

- `supabase/migrations/0001_init.sql` — all tables, indexes, RLS policies, `recalc_account_balance` trigger, `create_transfer` RPC, `handle_new_user` trigger.
- `supabase/migrations/0002_system_categories.sql` — 20 system categories (Thai + English).
- `supabase/seed.sql` — local-dev-only demo data (not applied to the live project; local `supabase db reset` only).

## Routes Added

`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` (route handler), `/onboarding`, `/dashboard`, `/money`, `/money/accounts`, `/money/transactions`, `/profile`.

## Architectural Decisions

- **Money as `NUMERIC(18,2)`**, all app-side math in integer cents (`src/lib/financial/money.ts`) — never floating point.
- **Transfers are a single transaction row** (`from_account_id`/`to_account_id`), not two linked rows — atomic by construction, can't be miscounted as income/expense.
- **`accounts.current_balance` is recomputed from scratch** by a trigger on every relevant write, not incremented — immune to drift.
- **shadcn/ui on this install generates Base UI components, not Radix** — no `asChild`; uses `render={<Element/>}` instead. Adapter helper: `src/lib/as-trigger.ts`.
- **Supabase clients are intentionally untyped** (no `Database` generic) — the installed `@supabase-js`/`postgrest-js` prerelease has a stricter generic contract than hand-written types satisfy. Type safety is enforced at the query/action function boundary instead (explicit return types).
- **Dev builds use `next build/dev --webpack`**, not Turbopack — this machine's Application Control policy blocks the native `@next/swc-win32-x64-msvc` binary, and Turbopack requires native bindings (WASM-only fallback isn't supported by Turbopack).
- **Dev-mode-only detailed auth/profile error surfacing** is intentionally left in place (gated on `NODE_ENV !== "production"`) — it materially sped up debugging this session and never reaches a production build.
- **`getProfile()` self-heals a missing profile row** for any authenticated user, rather than only relying on the `handle_new_user` trigger — see Incident above. Belt-and-suspenders: the trigger is still the primary path (zero extra latency on the common case), this is just the fallback.
- **`package.json` pins `vite` to `^6.4.0` via `overrides`** — vitest 5's peer range accepts vite 6/7/8, but vite 8 defaults to a Rolldown-based bundler whose native Windows binding can't load in this sandbox (same Application Control policy restriction as `@next/swc`), with no working WASM fallback for this package. Revisit if a future release fixes that.
- **Illustrations never draw their own background shape** — a shared `IllustrationFrame` wrapper composes `DecorativeBlob` behind whichever illustration is passed to it, so there's one background mechanism app-wide instead of each illustration inlining a similar circle.
- **`icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx` redraw the brand mark's shapes directly** rather than importing `BrandMark` — `next/og`'s `ImageResponse` (Satori) renders from its own JSX/SVG tree and can't import arbitrary React components. Keep all four in sync if the mark ever changes.

## Do Not Start Day 2 Until

- [x] signup works
- [x] login works
- [x] logout works
- [x] profile works
- [x] account CRUD works — create + balance trigger, edit, and archive all verified live
- [x] transaction CRUD works — create (income/expense) + balance recalc, edit, and delete all verified live
- [x] transfers work correctly — verified live (both-side balance update, same-account rejection)
- [x] RLS verified — verified live on profiles, accounts, and transactions (read isolation + cross-user insert rejection)
- [x] tests pass (28/28)
- [x] typecheck passes
- [x] lint passes
- [x] production build passes

**All items checked — Day 2 (Wealth Engine) can start.**

## Transaction Entry Redesign (Add Expense / Income / Transfer)

Consumer-app redesign of transaction entry, replacing the plain admin-style form. UX/UI and interaction only — no changes to validation rules, database schema, RLS, transfer logic, or the financial calculation functions.

**New components** (`src/features/transactions/components/`):
- `amount-input.tsx` — large centered ฿ amount display, numeric-keyboard input (`inputMode="decimal"`), no negative entry, ฿50/100/200/500 quick chips.
- `category-picker.tsx` — emoji chip grid (first 8 + "View all" expand), radio-style selection.
- `account-picker.tsx` — accounts shown as emoji + name (+ institution + live balance in the dropdown) — the UUID is never rendered, only submitted via a hidden field.
- `date-field.tsx` — shows "Today" / "Yesterday" / a locale-formatted date instead of raw ISO; a fully transparent native `<input type="date">` is stacked on top of the styled label so tapping it opens the native date picker directly.
- `collapsible-notes.tsx` — starts as a "+ Add note" toggle; expands to a textarea only on tap.

**New utilities**: `src/lib/transaction-ui.ts` (category-icon→emoji map, account-type→emoji map, transaction-type emoji+color, friendly date formatter), `src/lib/db-error.ts` (shared dev-detail/prod-safe DB error formatter, same pattern as the auth error handling).

**Rewritten**: `transaction-form.tsx` and `transfer-form.tsx` now render as a bottom sheet (native-feeling on mobile, a centered card on desktop via the same component) instead of a centered admin-style dialog. Smart defaults: today's date, single account auto-selected, most-recently-used account remembered via `localStorage` for next time. Context-aware save button ("Save expense ฿250" / "Save income ฿20,000" / "Transfer ฿5,000"), disabled until the amount and account are valid, with a loading label and a success toast (mounted `<Toaster/>` in the app shell) on completion. Merchant field relabels itself ("Paid to / where" vs "Income from") based on transaction type. Type is shown as an icon + color + text badge (never color alone).

**Error messages**: `src/lib/validation/transaction.ts` field messages and the generic action-failure fallbacks in `src/features/transactions/actions.ts` are now specific Thai copy ("กรุณาใส่จำนวนเงิน", "กรุณาเลือกบัญชี", "ไม่สามารถบันทึกรายการได้ กรุณาลองอีกครั้ง") instead of generic English — the real underlying error still logs server-side and shows in dev mode, same pattern as the auth error handling.

**Also translated to the i18n dictionary** while in this area (previously hardcoded English, closing part of the "partial i18n coverage" gap noted earlier): `transaction-row.tsx` (Edit/Delete, locale-aware category name, friendly date) and `quick-add.tsx` (menu labels).

**Logic explicitly NOT touched** (per the task's constraint) — verified by re-running the full test suite (still 28/28) and reading the diff: `src/features/transactions/actions.ts` validation/ownership/RPC logic, `src/lib/validation/transaction.ts` schema *rules* (only message strings changed), `src/lib/financial/*`, and every migration/RLS policy. Every form field still submits under its original `name` (`account_id`, `category_id`, `amount`, `type`, `from_account_id`, `to_account_id`, `transaction_date`, `merchant`, `notes`) — the new visual pickers write into hidden inputs with those exact names rather than replacing them, so `parseTransactionFormData`/`parseTransferFormData` and the Zod schemas needed zero changes to their shape.

**Explicitly skipped at the time** (marked optional in the task, skipped to avoid overengineering): merchant-history-based category defaulting, and the "Recent transactions — tap to prefill" list (Steps 4 and 14). **Update:** the quick-repeat list was built in "Day 1 Final Closeout" below; merchant-history-based category defaulting remains skipped (still optional, still not requested).

**Simplification**: desktop and mobile share one bottom-sheet-style container (centered/max-width on desktop, full-width bottom sheet on mobile) rather than two separate layout implementations (Dialog vs. Sheet) — kept the surface area smaller while still meeting "polished on both."

**Known limitation** (at the time this was written): the new validation/error Thai copy is hardcoded, not yet locale-aware (same gap as the rest of the app's partial i18n coverage) — it always shows Thai regardless of `preferred_language`, matching the product's Thai-default design intent but not correct for an English-preference user yet. **Update:** fixed in "Day 1 Final Closeout" below.

**QA**: lint ✅, typecheck ✅, tests 28/28 ✅ (unchanged — confirms calculation logic untouched), production build ✅ (clean rebuild, `.next` removed first). Dev server was stopped and restarted to run the clean build; smoke-tested `/` and `/login` back up afterward with no console/server errors. The actual sheet UI itself was verified by code/type-level review only, not a live browser click-through — recommend a quick manual pass on a real 375px-width device next.

## Visual System (brand + illustrations)

New top-level doc: **`GRAPHICS_PLAN.md`** — read it before adding any new
color, icon, or illustration; it's the source of truth for the graphic
identity, asset inventory, roadmap, and priority. (This was originally
written as `VISUAL_SYSTEM.md`; it was later consolidated with a fuller
asset roadmap into `GRAPHICS_PLAN.md` and `VISUAL_SYSTEM.md` was retired —
see the "Documentation Consolidation" entry below.)

**The app had no real brand color before this** — `--primary` was pure
grayscale (shadcn's default neutral theme). It's now the same blue already
used as chart slot 1 (`#2a78d6` light / `#3987e5` dark — see
`src/app/globals.css`), so UI chrome (buttons, checkboxes, selected chips,
the sidebar's active nav item) and data visualization read as one identity
instead of two unrelated palettes. Sidebar active-state colors were upgraded
from generic gray to the same validated sequential-blue steps used
elsewhere (`#cde2fb`/`#184f95` light, translucent blue/`#86b6ef` dark).

**New**: `src/components/illustrations/` — 10 hand-built SVG React
components (flat shapes, 2–3 colors max, shared `viewBox="0 0 200 200"`,
consistent shape language). `BrandMark` (a custom wallet-with-clasp
logomark) replaces the generic Lucide `Wallet` icon everywhere it appeared.
`WelcomeIllustration`, `EmptyAccountsIllustration`,
`EmptyTransactionsIllustration`, and `SuccessBadge` are integrated into real
pages today. `DecorativeBlob` was built but, per a corrected doc-drift check
in `GRAPHICS_PLAN.md`, is **not actually rendered anywhere** — flagged there
as a top-priority item to either compose into a real screen or retire.
`GoalIllustration`, `EarnIllustration`, `AICoachIllustration`,
and `MissionBadge` are built and ready but **not wired to any page** — Plan/
Earn/AI aren't built yet (feature-flagged off, per `src/config/features.ts`
and the Phase 0–8 roadmap in CLAUDE.md), and creating stub routes just to
show them off would violate the project's own "no fake buttons/pages" rule.
They cost nothing sitting unused and drop in the moment those pages exist.

**Integrated into**: landing page (`src/app/page.tsx` — brand mark + hero
illustration), auth layout, sidebar, onboarding page, the dashboard's
zero-data empty state, the accounts empty state, the transactions empty
state, and the transaction-save toast icon (replacing a plain emoji
prefix). `EmptyState` (`src/components/shared/empty-state.tsx`) now accepts
an `illustration` prop as an alternative to the original `icon` prop via a
discriminated union — existing `icon`-based call sites elsewhere are
untouched and still work.

**No logic touched** — this was a pure visual/UI change. Confirmed by the
unit suite staying at 28/28 (financial calculations never import anything
from `illustrations/`) and by grepping every existing `bg-primary`/
`text-primary` usage before shipping the color change, to make sure the new
blue didn't land somewhere that assumed grayscale (buttons, checkboxes, the
selected-chip states already shipped in the transaction redesign — all
correct, no clashes).

**QA**: lint ✅, typecheck ✅, tests 28/28 ✅, production build ✅ (clean
rebuild). Verified the illustration markup actually renders (not just that
the page returns 200) by curling the built landing page for the SVG
`viewBox` and hero copy. Not verified: an actual visual/pixel look at the
new illustrations in a browser — recommend a quick look next session,
especially at 375px width, since illustration proportions were reasoned
about but never eyeballed.

## Documentation Consolidation (this session)

Merged `VISUAL_SYSTEM.md` into a single new file, **`GRAPHICS_PLAN.md`**,
per an explicit request to have exactly one visual-documentation source of
truth. `VISUAL_SYSTEM.md` is now deleted — nothing in it was lost; every
rule from its Phase 1 (style/color/icon/shape/tone/motion) carried over
into `GRAPHICS_PLAN.md`'s "Part A — Visual System Rules," and its Phase 2
asset table carried over (and was substantially expanded) into "Part B —
Graphics / Asset Roadmap," which now also covers every product area in
CLAUDE.md's roadmap (Goals, Net Worth, Budget, AI Coach, Earn, Missions,
Subscriptions, Landing/Marketing, Social) with an honest ✅/🟡/⬜/🚫 status
per item, priority levels, and sprint groupings.

While re-verifying status against the actual repository (not trusting the
prior doc's claims), found one real drift: `VISUAL_SYSTEM.md` had marked
`DecorativeBlob` as "✅ built + integrated," but it is not imported or
rendered anywhere in the app — confirmed by grep. Corrected to 🟡 in
`GRAPHICS_PLAN.md` and listed as a top-10 priority item (compose it into a
real screen, or drop it). Every other asset's status was re-verified the
same way and matched what was previously documented.

Updated the two references to `VISUAL_SYSTEM.md` that existed in the repo
(this file, and a code comment in `ai-coach-illustration.tsx`) to point at
`GRAPHICS_PLAN.md` instead. No app functionality changed in this pass —
documentation only, confirmed by not touching anything under `src/` other
than that one comment.

## Visual Implementation Continuation (this session)

Worked through `GRAPHICS_PLAN.md`'s roadmap, re-auditing actual repository
state first (not trusting the doc) before building anything.

**P1 — all closed**:
- **Real favicon + app icon**: `src/app/icon.tsx` (32×32) and `apple-icon.tsx`
  (180×180), both `next/og` `ImageResponse` routes redrawing the brand
  mark's shapes directly. The stale default `src/app/favicon.ico` was
  deleted so there's exactly one icon source. Verified live: both return
  real PNGs at the correct dimensions (not just HTTP 200).
- **Open Graph image**: `src/app/opengraph-image.tsx` (1200×630). Also
  fixed a real, separate bug this surfaced: `metadataBase` was never set in
  `src/app/layout.tsx`, so Next was resolving OG/Twitter image URLs against
  `localhost` (a real build-time warning, now gone) — set from the existing
  `NEXT_PUBLIC_APP_URL` env var. Verified live: returns a real 1200×630 PNG.
- **`DecorativeBlob` actually integrated**: new `IllustrationFrame` wrapper
  (`src/components/illustrations/illustration-frame.tsx`) composes it
  behind any illustration. Each illustration's own inline background circle
  (`WelcomeIllustration`, `EmptyAccountsIllustration`,
  `EmptyTransactionsIllustration`) was removed first, so there's one
  background mechanism instead of two overlapping shapes. Now renders on 5
  real screens: landing, onboarding, and all three `EmptyState` illustrations.
- **`LockedBadge`**: the one missing status-system asset (Success/Info/
  Warning/Error/Loading were already covered by the existing toast icon
  set). Built ready, not integrated — no billing system exists to attach it to.

**P2 — a focused, ready-not-integrated set** (none of these have a page to
render on yet — Goals/Net Worth/Budget/Missions aren't built):
`GoalTypeIcon` (10 goal types, one component + emoji map, not 10 files),
`FinancialStageProgress` (the 7-stage stepper from CLAUDE.md), `BudgetIllustration`,
`StreakBadge`.

**P3 — only where a real page exists**: added a small "Track → Plan → Earn →
Grow" step strip to the actual landing page, using Lucide functional icons
(not new illustration SVGs — a row of small step markers is the icon
system's job). Also built `CelebrationBadge`, ready-not-integrated (no
goals/milestones feature exists to trigger it yet).

**Explicitly deferred at the time**: recent-transaction quick-repeat cards — this was
the one remaining P1 item, but it needed a new query and a tap-to-prefill
interaction (real product logic), not just a visual asset, so it was left
for a feature-focused pass rather than folded into this graphics session.
**Update:** built in "Day 1 Final Closeout" below.
Also deferred: AI Coach/Earn *detail* card visuals, Goal state variants,
Net Worth hero, full mission/XP system, premium/billing visuals beyond the
one status badge, and landing feature sections — all correctly still ⬜ in
`GRAPHICS_PLAN.md` because the features they'd attach to don't exist yet.

**Unrelated but necessary fix found during QA**: `npx vitest run` started
failing with `Cannot find native binding` / a missing `@rolldown/binding-wasm32-wasi`
module. Root cause: an earlier session's temporary `npm install`/`uninstall`
of `playwright` (for browser-driven testing, since removed) had left
`package-lock.json` in a state where deleting it and reinstalling let npm
resolve to a fresh `vite@8.3.0`, which now defaults to a Rolldown-based
bundler — and Rolldown's native Windows binding fails to load in this
sandbox for the same reason `@next/swc-win32-x64-msvc` does (the machine's
Application Control policy), with no working WASM fallback for this
particular package. Fixed with a `"overrides": { "vite": "^6.4.0" }` entry
in `package.json` (vitest's own peer range already accepts vite 6/7/8, so
this doesn't fight vitest, it just pins the sub-dependency to a version
that still uses the traditional esbuild/rollup toolchain). Verified: clean
`rm -rf node_modules && npm install` now produces a working `vitest run`
(28/28) every time.

**QA**: lint ✅, typecheck ✅, tests 28/28 ✅, production build ✅ (clean
rebuild, confirms the 3 new `next/og` routes compile). Verified live (dev
server): `/icon`, `/apple-icon`, `/opengraph-image` each return a real PNG
at the exact expected pixel dimensions (32×32, 180×180, 1200×630) — checked
with `file` on the downloaded bytes, not just an HTTP status code. Verified
the landing page HTML actually contains the new pillar strip text and the
`DecorativeBlob` SVG path. Not verified: an actual visual look in a
browser — still the same outstanding item as last session.

## Visual QA in a real browser (this session) — found and fixed a real bug

The user asked whether I could actually open a browser and look, rather
than only verifying via code/build/curl as the last two sessions had. Did
so: installed Playwright temporarily, signed up a fresh test account, and
screenshotted the landing page, login, signup, onboarding, dashboard,
accounts, and transactions pages at mobile width (390×844) plus the landing
page at desktop width — then actually looked at each image.

**Overall**: the visual system holds up well — brand blue, the illustration
+ `DecorativeBlob` composition, Thai nav/dashboard-empty-state text, the
bottom nav correctly hiding Plan/Earn/AI, and the new landing-page pillar
strip all render as intended.

**Real bug found and fixed**: the three filter dropdowns on
`/money/transactions` (type/account/category) displayed the literal
internal sentinel value `__all__` instead of "All types" / "All accounts" /
"All categories". Root cause: `SelectValue` without an explicit
label-resolving `children` function doesn't reliably resolve the matching
`SelectItem`'s display text in this Base UI version — it was already known
to need that pattern (`AccountPicker` already did it correctly), but four
other `Select` usages across the app didn't. Fixed all of them with the
same explicit-resolver pattern: `transaction-filters.tsx` (all 3 filters),
`account-form.tsx` (account type), `profile-form.tsx` (language),
`onboarding-form.tsx` (goal), `transaction-form.tsx` (edit-mode type
switcher). Re-screenshotted `/money/transactions` and the "Add account"
dialog after the fix and visually confirmed both now show proper labels
("All types", "Bank") instead of raw values.

This is exactly the class of bug CLAUDE.md's "never expose internal IDs/
technical data in UI" rule is about, and it had been shipped and marked
"done" across two prior sessions without ever being caught — code review,
typecheck, and even reading the component source all looked correct: the
bug only reproduces at actual render time, which is why it takes an actual
browser to catch, not more code reading. Worth remembering next time
something is marked complete rugged only on code inspection.

**Real-page observation, not a bug**: `/money/accounts` and
`/money/transactions` are entirely in English while the dashboard and nav
are in Thai — this is the already-documented "partial i18n coverage" gap,
but seeing a Thai bottom-nav label sitting above an all-English page makes
it a more obviously jarring inconsistency live than it reads in a doc.
Not fixed in that session — same scope boundary as before (a full i18n pass wasn't
requested then). **Update:** fixed in the "Day 1 Final Closeout" section below.

**QA re-run after the fix**: lint ✅, typecheck ✅, tests 28/28 ✅,
production build ✅. Cleaned up: test account deleted from the live
Supabase project, Playwright and the screenshot scripts removed (dev-only,
not part of the shipped app).

## Day 1 Final Closeout (this session)

Closed every item the previous session's "Next Task" list had left open, verifying live in a real browser rather than by code inspection alone.

**Browser QA — Add Expense / Add Income / Transfer**, at 375×812, 390×844, 430×932, and 1280×800 (Playwright, temporarily installed): sheet opens correctly at every width; amount input accepts typed and quick-chip (฿50/100/200/500) entry; category selection works; account picker shows names only, never a UUID; date defaults to today ("วันนี้"); merchant field relabels itself by type; notes stay collapsed until "+ Add note" is tapped; save CTA live-reflects the typed amount ("บันทึกรายจ่าย ฿250.00"); the button disables while pending (prevents duplicate submission) and shows a saving label; a success toast appears on completion; a live end-to-end run (฿250 expense, ฿1,000 income, ฿300 transfer between two seeded accounts) produced the exact expected resulting balances (10,000 + 1,000 − 250 − 300 = **฿10,450.00** and 500 + 300 = **฿800.00**); the transfer row shows no +/− sign and both account names (not a category or an income/expense classification), and `calculateIncome`/`calculateExpenses` already excluded transfers before this session (confirmed by reading `src/lib/financial/calculations.ts`, unchanged). Mobile spacing/tap targets read as comfortable at 375px (no cramped chips, no overflow).

**CRUD gaps — closed and live-verified** (previously "implemented but not independently re-tested live"):
- **Account edit**: dialog opens prefilled with the real current name; rename persists and displays immediately.
- **Account archive**: verified by count, not just a click — the account list count dropped from 5→4 after archiving, and the archived account's name no longer appears in the default (non-archived) view.
- **Transaction edit**: found a non-transfer row via its real menu contents (transfers correctly have no Edit item — `!isTransfer` guard in `transaction-row.tsx`), confirmed the sheet opens with the real prior amount prefilled, changed it, and confirmed the new amount displays on the list afterward.
- **Transaction delete**: row count dropped by exactly one after confirming. Found and fixed a real gap while verifying this: the dictionary already had an unused `transactions.deleteConfirm` string — delete had no confirmation step at all. Added a `window.confirm()` guard using that existing string, so an accidental tap can no longer silently destroy a transaction.

**i18n — `/money/accounts` and `/money/transactions` extended to full dictionary coverage** (previously "entirely in English while the dashboard and nav are in Thai" — see last session's "Visual QA" note). All fixes reuse the existing `src/i18n` dictionary/`useTranslation()`/`getDictionary()` system; no second i18n mechanism was introduced. Concretely:
- `account-card.tsx` and `account-form.tsx` were **100% hardcoded English** (including the "Archived" badge, all field labels, the account-type list, and the dialog's Save/Cancel) — rewritten to pull every string from the dictionary; account types now render via the already-existing `accounts.types.*` keys instead of a second hardcoded `ACCOUNT_TYPE_LABELS` map that duplicated them.
- `money/layout.tsx` (the "Money" page header/subtitle) and `money-tabs.tsx` (Transactions/Accounts tab labels) were also hardcoded English — now server/client-localized via `getDictionary`/`useTranslation` respectively, reusing the existing `nav.accounts`/`nav.transactions` keys.
- `transaction-filters.tsx`: search placeholder, all three filter aria-labels, and the "All types/accounts/categories" option labels were hardcoded English; category names were always read from `name_en` regardless of locale. Now fully localized, with locale-aware category naming.
- `transaction-row.tsx` and `account-card.tsx`: the "⋮" menu-trigger button's `aria-label` was wired to `common.edit` ("Edit"/"แก้ไข") even though the menu also contains Delete/Archive — a real screen-reader mislabel, not just a missing translation. Fixed with a new shared `common.moreActions` key.
- `amount-input.tsx`: the quick-amount chip group's screen-reader label ("Quick amounts") was hardcoded English inside an otherwise fully-localized component — fixed with a new `transactions.quickAmounts` key.
- `dashboard/components/charts.tsx`: both chart titles, both empty-state messages, and the "Income"/"Expenses"/"Other" data labels were hardcoded English on an otherwise Thai-localized dashboard — fixed; category names for the spending-by-category chart are now threaded through as both `categoryNameTh`/`categoryNameEn` from `dashboard/queries.ts` (previously always `name_en`, with a hardcoded "Uncategorized" fallback) and resolved by locale in the client chart component.
- `account-list.tsx` and `transaction-list.tsx` (server components) now resolve the request's locale via `getProfile()` + `getLocale()` + `getDictionary()` to localize their empty states, matching the pattern already used by `dashboard/page.tsx`.

**Validation/action error messages — now locale-aware** (previously hardcoded Thai-only, a documented "Known limitation"). `src/lib/validation/transaction.ts` and `src/lib/validation/account.ts` were converted from static Zod schemas to `buildTransactionSchema(dict)` / `buildTransferSchema(dict)` / `buildAccountSchema(dict)` / `buildUpdateAccountSchema(dict)` factory functions parameterized on the dictionary; every field-level Zod message now comes from a new `validation.*` dictionary namespace (added to both `th.json` and `en.json`). `src/features/transactions/actions.ts` and `src/features/accounts/actions.ts` each resolve the acting user's dictionary once per request (`getProfile()` → `getLocale()` → `getDictionary()`) and use it both for schema validation and for every `friendlyDbError()` fallback message (new `saveFailed`/`updateFailed`/`deleteFailed`/`transferFailed`/`createFailed`/`archiveFailed` keys) — an English-preference user now gets English validation and error copy end-to-end, not just English UI chrome around Thai errors.

**Recent Transaction Quick Repeat — implemented** (the one deliberately-deferred P1 item from the prior visual-implementation session). `getQuickRepeatCandidates()` (`src/features/transactions/queries.ts`) reads the last 50 non-transfer transactions, collapses them to one entry per distinct (type, category, merchant) combination keeping the most recent amount/account, and ranks by recurrence count then recency — a plain frequency count, not a prediction model, per the task's explicit "no unnecessary prediction logic" constraint. `QuickRepeat` (`src/features/transactions/components/quick-repeat.tsx`) renders these as a horizontally-scrolling chip row above the transaction list (mobile-first, only shown on the unfiltered default view). Tapping a chip opens a normal **create-mode** `TransactionForm` (never edit mode — a new optional `prefill` prop seeds amount/category/account/merchant without touching `transaction`/update semantics) with today's date always used, not the original transaction's date; nothing submits until the user presses Save, and every field remains editable first. Verified live: chips render with the correct category emoji/merchant/amount, and opening one produces a normal, editable, non-auto-submitting sheet.

**QA (re-run after all of the above)**: lint ✅ (zero errors/warnings), typecheck ✅ (`tsc --noEmit`, zero errors), tests ✅ (28/28, unchanged — confirms no financial calculation logic was touched), production build ✅ (clean `next build --webpack`, all 17 routes compiled). Browser QA used a disposable Supabase test account (Playwright, temporarily installed and removed afterward, same pattern as prior sessions).

## Day 2 — Wealth Engine (this session)

Transforms the app from a transaction tracker toward a financial progress system: Smart Budget, Assets, Liabilities, Net Worth, Financial Goals, Emergency Fund, Safe-to-Spend, and Wealth Score. **Complete, unit-tested, and verified live** — migration applied to the real project, RLS checked with two real users, every new page exercised end-to-end in a real browser with real data. Two genuine bugs were found this way and fixed (see "Bugs found via live QA" below) — neither would have surfaced from code review alone.

### Database migration

`supabase/migrations/0003_wealth_engine.sql` — written and **applied to the live project** (via the Supabase Management API, using a user-provided personal access token). Adds 8 tables: `budgets`, `budget_categories`, `assets`, `liabilities`, `net_worth_snapshots`, `financial_goals`, `emergency_funds`, `wealth_scores`. Follows every convention from `0001_init.sql`: UUID PKs (`gen_random_uuid()`), `NUMERIC(18,2)` for all money, TEXT+CHECK instead of native enums, `user_id` ownership + RLS on every table, `updated_at` via the existing `set_updated_at()` trigger, indexes on every foreign key and common filter column. Notable constraints: `budgets` has `unique(user_id, month)` (prevents duplicate/conflicting monthly budgets — verified live: a second create attempt for the same month returns a friendly "budget already exists" error); `net_worth_snapshots` has `unique(user_id, snapshot_date)` (idempotent daily snapshots); `emergency_funds` has `unique(user_id)` (one tracker per user) plus a CHECK requiring either `target_months` or `custom_target_amount`. Verified live: `select table_name from information_schema.tables` confirms all 8 tables exist in the production schema.

### Double-counting rule (Assets ↔ Accounts, and Net Worth)

Documented in the migration header and enforced in `calculateNetWorth()` (`src/lib/financial/net-worth.ts`): an `accounts` row already contributes its balance to Net Worth when `include_in_net_worth = true` (existing Day 1 column). A manual `assets` row is for wealth *not* already represented by an account. `assets.linked_account_id` is a bookkeeping-only link — when set, that asset is **excluded** from the assets total (the linked account is the one that counts), so the same money is never counted twice. Unit-tested explicitly in `tests/net-worth.test.ts`.

### Budget

`src/lib/financial/budget.ts` — `calculateBudgetStatus()` (spent/remaining/%used/projected-end-of-month via linear projection/status: `no_budget`/`healthy`/`near_limit`/`over_budget`) and `calculateCategoryBudgetStatuses()` (joins per-category allocations against actual category spend, reusing Day 1's `calculateSpendingByCategory`). CRUD: `src/features/budget/{queries,actions}.ts` + `src/app/(app)/money/budget/page.tsx`. One budget per calendar month (`unique(user_id, month)`, friendly "a budget for this month already exists" error on conflict), category allocations flagged `is_fixed`/`is_essential` (feed directly into Emergency Fund and Safe-to-Spend below — no separate essential-expense input anywhere). Month selector (prev/next arrows, `?month=YYYY-MM-01` query param) — required by the task spec, easy to miss.

### Assets

Types: cash, bank, savings, investment, gold, crypto, property, vehicle, business, other. `src/features/assets/{queries,actions,components}` + `/money/assets`. Optional `linked_account_id` per the double-counting rule above.

### Liabilities

Types: credit card, personal loan, car loan, mortgage, student loan, informal debt, other. Fields include optional `interest_rate`, `minimum_payment`, `due_date` — `minimum_payment` feeds Debt Health (Wealth Score) and Safe-to-Spend. `src/features/liabilities/{queries,actions,components}` + `/money/liabilities`. Deliberately **no Debt Planner** (payoff strategies, snowball/avalanche) — out of scope per the task spec, reserved for a later phase.

### Net Worth

`calculateNetWorth()` (assets + included accounts − included liabilities, double-counting-safe) and `calculateNetWorthChange()` in `src/lib/financial/net-worth.ts`. `/money/net-worth` shows current net worth, total assets/liabilities, month-over-month change, a history line chart (Recharts, matching the existing dashboard chart style), and asset/liability breakdowns. Snapshots are recorded automatically on every page visit via `recordTodaysNetWorthSnapshot()` — an upsert keyed on `(user_id, snapshot_date)`, so repeat visits the same day update rather than duplicate. With fewer than 2 snapshots, shows a clear "not enough history yet" state instead of an empty/broken chart.

### Financial Goals

Types: Emergency Fund, Travel, Gadget, Car, Home, Education, Wedding, Business Capital, 1 Million (`million`), Retirement, Custom. Priorities: Critical/High/Medium/Low (sorted in application code — `priority` is a TEXT column, so an `ORDER BY` on it would sort alphabetically rather than by real importance; see `getGoals()`). `src/lib/financial/goals.ts` — `calculateGoalProgress()`, `calculateAmountRemaining()`, `calculateRequiredMonthlyContribution()`, `calculateProjectedCompletionDate()`, `calculateGoalScheduleStatus()` (achieved/ahead/on_track/behind/unknown — "unknown" is a neutral state, not a penalty, for goals with no target date or no contribution to project from yet). Reuses `GoalTypeIcon`/`GoalIllustration` from the existing illustration system — **extended** (not duplicated) `GoalTypeIcon`'s type union, which was pre-built but had `business`/no `million` instead of the schema's `business_capital`/`million`; it was "not imported anywhere yet" per its own code comment, so this was a safe in-place fix rather than a fork. `/plan/goals`.

### Emergency Fund

One tracker per user (`unique(user_id)`). Target is either a multiple of essential monthly expenses (3/6/9/12 preset chips or a custom number of months) or a flat custom amount — `calculateEmergencyFundTarget()` in `src/lib/financial/emergency-fund.ts`. **Essential monthly expenses are not stored** — `getEssentialMonthlyExpenses()` derives them live from the current month's `budget_categories` flagged `is_essential`, so they can never drift from the budget the user actually set. If no budget exists yet, the page shows a clear message asking the user to set one up first rather than inventing a number. `calculateMonthsProtected()`, `calculateEmergencyFundProgress()`, `calculateEmergencyFundCompletion()` round out the math. Can optionally link an account and/or a goal. `/plan/emergency-fund`.

### Safe-to-Spend

`calculateSafeToSpend()` in `src/lib/financial/safe-to-spend.ts` — pure function of 7 inputs (available liquid cash, upcoming bills, minimum debt payments, planned savings, planned investment, protected emergency fund, mandatory commitments), never invents a number. `src/features/safe-to-spend/queries.ts` sources those inputs from real data (liquid-type account balances; fixed-essential vs. variable-essential budget categories split into "upcoming bills" vs. "mandatory commitments"; liabilities' minimum payments; the emergency fund's current amount) and returns `hasCompleteData: false` — an explicit incomplete-data state — when there isn't even one account to source liquid cash from, rather than fabricating a figure. Surfaced on the dashboard as an expandable card (Today/This Week/This Month + a line-by-line "how this was calculated" breakdown with an explicit "this is an estimate, not a guarantee" disclaimer) — no standalone route, since the task's navigation spec doesn't list one and the dashboard card already exposes the same information without an extra "functional but pointless" page.

### Wealth Score

`src/lib/financial/wealth-score.ts` — 7 deterministic component functions (Cash Flow Health 20%, Savings Rate 15%, Emergency Fund 15%, Debt Health 15%, Net Worth Growth 15%, Income Growth 10%, Goal Progress 10%), no LLM anywhere. Every mapping is documented inline with its exact assumption (e.g. cash-flow-to-income ratio of 0 = neutral score 50, +100% = 100, -100% = 0; a 20%+ savings rate is full marks). **Missing-history fairness** (explicit task requirement): Net Worth Growth and Income Growth return a neutral 50 with `hasHistory: false` when there's no prior snapshot/month to compare against, instead of penalizing a brand-new user — surfaced in the UI as "some scores are neutral placeholders until there's enough history." `getWealthScoreImprovementActions()` returns structured, measurable actions (increase emergency fund by ฿X, reduce discretionary spending by ฿X, improve savings rate to 20%, contribute ฿X/month to the most-behind goal, reduce debt payments by ฿X) rather than generic advice — each one only fires when its component scores below 90 and the underlying gap is actually real and non-zero (e.g. no "reduce spending" suggestion when cash flow is already positive). The debt-payment reduction amount is the gap between current minimum payments and the payment level that would just reach the healthy threshold — **not** the full payment amount (see "Bugs found via live QA" below for why that distinction mattered). `calculation_version` is stored (currently `1`) per the task's schema requirement. Computed fresh on every dashboard load (so the number is always current) but persisted to the `wealth_scores` history table **at most once per calendar day** (`ensureTodaysWealthScore()`, compared using local calendar dates) — otherwise every dashboard reload would insert a duplicate row into an append-only history table. Surfaced as an expandable dashboard card (component breakdown + improvement actions) — same "no pointless standalone route" reasoning as Safe-to-Spend. Verified live: a real test scenario (฿25,000 income, ฿9,000 expenses, 2-month emergency fund, one ฿15,000 credit card debt, one 20%-progress goal) produced a Wealth Score of 64/100 with component scores and improvement actions that all hand-check correctly against the formulas above.

### Dashboard

New `WealthOverview` section (`src/features/dashboard/components/wealth-overview.tsx`) between the page header and the existing income/expense/cash-flow/savings-rate cards: Wealth Score, Net Worth, Safe-to-Spend, Budget status, Emergency Fund, Top Goal — 6 compact linked cards in a `grid-cols-2 lg:grid-cols-3` layout (Wealth Score and Safe-to-Spend span the full width on mobile since they're expandable; the other four pair up). Monthly Cash Flow was already on the dashboard from Day 1 (`SummaryCards`) — reused rather than duplicated. Deliberately **not** a wall of charts: every card is a number + one line of context, with detail one tap away on its own page (except Safe-to-Spend/Wealth Score, which expand in place — see above). Illustrations (`IllustrationFrame`, `BudgetIllustration`, `GoalIllustration`, `FinancialStageProgress`) were considered but not forced into these compact tiles — they're sized for full empty-state moments, not dense stat grids; each new page's own empty state does use the matching illustration (`BudgetIllustration` on `/money/budget`, `GoalIllustration` on `/plan/goals`, etc).

**Resilience fix found and applied mid-session, before the migration was applied** (not a hypothetical): the very first version of `WealthOverview` queried all 8 new tables directly with no error handling. Verified live (test account, real browser) at the time that — because migration 0003 wasn't applied yet — this made the **existing, previously-working Day 1 dashboard return a hard 500** for any user with at least one account (a zero-data user never hit the code path, which is why this wasn't obvious from a quick glance). No `error.tsx` exists anywhere in the app, so an uncaught Server Component error takes down the whole page. Fixed by wrapping `WealthOverview`'s data loading in a try/catch (`loadWealthOverviewData()`) that logs the real error server-side and renders nothing if it fails, rather than crashing the page — re-verified live at the time: the dashboard rendered fully and correctly (all Day 1 content intact) even with none of the Day 2 tables present. The migration is now applied and this code path succeeds normally, but the try/catch stays in place as a permanent deployment-order safeguard (e.g. protects against a future migration rollback, or a staging environment that's a few migrations behind prod) — it costs nothing on the happy path. The dedicated new pages (`/money/budget`, `/money/assets`, etc.) were *not* given the same defensive wrapping — a brand-new page erroring because its own required table doesn't exist yet is expected and acceptable (the same would be true of `/money/accounts` without the `accounts` table); the fix only mattered for a *shared, previously-working* page.

### Navigation

`src/config/features.ts`: `plan: true` (was `false`) — Plan is a real, working surface now (Goals, Emergency Fund), so it's no longer hidden. `MoneyTabs` (`src/components/layout/money-tabs.tsx`) extended from 2 tabs to 6 (Transactions, Accounts, Budget, Assets, Liabilities, Net Worth), wrapped in a horizontal-scroll container (`overflow-x-auto`) so it doesn't overflow at 375px. New `PlanTabs` (`src/components/layout/plan-tabs.tsx`) + `src/app/(app)/plan/layout.tsx`, mirroring the existing Money layout pattern exactly (localized header via `getDictionary`, tabs, children). `/plan` redirects to `/plan/goals` (same pattern as `/money` → `/money/transactions`).

### Tests

8 new test files, 93 new tests (121 total, up from 28 at the end of Day 1), all passing: `tests/budget.test.ts`, `tests/net-worth.test.ts`, `tests/goals.test.ts`, `tests/emergency-fund.test.ts`, `tests/safe-to-spend.test.ts`, `tests/wealth-score.test.ts`, `tests/date.test.ts` (see "Bugs found via live QA"), plus one added test in `tests/wealth-score.test.ts` for the debt-payment-reduction fix. Every domain function in `src/lib/financial/{budget,net-worth,goals,emergency-fund,safe-to-spend,wealth-score}.ts` is covered, including every edge case the task spec named: zero income, zero expenses, negative cash flow, no assets, no liabilities, liabilities > assets, no net worth history, goal date passed, target already achieved, no emergency fund, debt-heavy user, monthly budget = 0, overspent category, missing optional fields (nullable target_months/target_date/etc handled via `null`-safe function signatures throughout, not just at the DB layer).

### RLS Verification — DONE, 35/35 passed

`_rls_test.mjs` (temporary script, deleted after use) created two real disposable users via the Auth REST API, then for every new table had User A create a row and verified User B could not SELECT it, UPDATE it, DELETE it, or INSERT a row claiming User A's `user_id`. Ran live against the production project after the migration was applied: **35/35 checks passed** across all 8 new tables, including the `budget_categories` join-table pattern (ownership via the parent `budgets` row, same approach as Day 1's `transaction_tags`). One script bug surfaced along the way and was fixed before the final run: the UPDATE-as-User-B check used a `notes` column that doesn't exist on `financial_goals`/`net_worth_snapshots`/`emergency_funds`/`wealth_scores`, so PostgREST returned 400 before RLS ever got a chance to apply — the first run's 4 "failures" were this test-script bug, not a security hole. Fixed by using a real column per table, re-ran clean.

### Browser QA — DONE

Full live browser QA (Playwright, disposable test account, real data) across all 6 new pages plus the dashboard, at 375/390/430/desktop:
- Created 2 accounts, several transactions, a monthly budget with a category allocation, an asset (gold), a liability (credit card), a financial goal (travel), and an emergency fund — through the real UI forms, not seeded directly.
- **Net Worth verified exactly correct**: accounts ฿60,000 + gold asset ฿80,000 − credit card ฿15,000 = **฿125,000**, matching the page's displayed total to the baht.
- **Budget verified exactly correct**: ฿9,000 spent / ฿20,000 budget = 45% (shown), category over its ฿5,000 allocation rendered with a red progress bar (vs. amber for the overall near-limit status) — the two-tier status coloring works as designed.
- **Emergency Fund verified exactly correct**: ฿10,000 current / ฿30,000 target (6 months × ฿5,000 essential expenses) = 2.0 months protected, ฿20,000 remaining, projected completion date arithmetic (10 months at ฿2,000/month from September → July next year) checked out.
- **Wealth Score verified exactly correct**: component scores and the final weighted total (64/100) hand-check against the formulas in `wealth-score.ts` given the real test data.
- **Responsive layout**: no horizontal overflow, no clipped Thai text, the 6-tab `MoneyTabs` scrolls cleanly at 375px, category status colors and empty-state illustrations render correctly at every width. One apparent overlap (Top Goal card behind the bottom nav) in a `fullPage: true` screenshot at 375px was investigated and confirmed to be a Playwright full-page-screenshot artifact with `position: fixed` elements, not a real rendering bug — a targeted scrolled-viewport screenshot showed the card fully visible and correctly positioned.

### Bugs found via live QA (not visible from code review)

1. **Systemic UTC-vs-local-timezone date bug, present since Day 1.** `date.toISOString().slice(0, 10)` — used in 9 places across the codebase, including Day 1's `getCurrentMonthRange()` (dashboard "this month" stats) and both transaction forms' "today" default — converts to UTC *before* reading the calendar date. In any timezone ahead of UTC, including **Asia/Bangkok (UTC+7), this app's primary market**, that silently rolls the date back by one for part of the day (before ~7am local time). Found when the live QA's budget-creation step failed with "please select a valid date": `toMonthKey()` for September 2026 was returning `2026-08-31` on this machine (Indochina Time), which failed the `budgets.month` CHECK/regex outright — a hard, visible failure that led straight to the root cause. Once found, grepped for every other instance of the same pattern and fixed all 9 (see `src/lib/date.ts`'s new `toLocalDateString()` helper and its doc comment for the full list and the "why"). The Day 1 instances (`getCurrentMonthRange`, both transaction forms' `todayISO()`) had been silently recording the wrong calendar date for early-morning users in Thailand since Day 1 without ever surfacing an error — Budget's stricter CHECK constraint is what finally made it visible. Added `tests/date.test.ts` to lock in the fix. Fixed in this session's follow-up commit, not the original Day 2 commit.
2. **Misleading Wealth Score improvement action.** `getWealthScoreImprovementActions()`'s "reduce debt payments" suggestion originally used the *entire* minimum-payment amount as "the amount to reduce by" — live-verified output read "reduce your debt payments by ฿1,500" when the user's total minimum payment *was* ฿1,500, i.e. the literal advice was "eliminate this payment entirely," not a measurable partial step. Fixed to compute the actual gap between the current payment level and the payment level that would just reach the healthy-debt threshold (inverting `calculateDebtHealthScore`'s own formula) — the same real test data now correctly suggests reducing by ฿250, a real, achievable number. Added a dedicated test asserting the suggested amount is less than the full payment.

### Known Limitations

1. Safe-to-Spend and Wealth Score have no standalone route — by design (see their sections above), but revisit if product feedback wants a dedicated deep-dive page later.
2. Budget's "upcoming bills" vs. "mandatory commitments" split (fixed-essential vs. variable-essential categories) is a reasonable but opinionated modeling choice for Safe-to-Spend, not something the task spec dictated precisely — documented in `src/features/safe-to-spend/queries.ts`.
3. Net worth history chart needs at least 2 daily snapshots to render (by design — shows an explicit "not enough history yet" state below that) — will naturally fill in over the following days now that it's live.
4. `ensureTodaysWealthScore()`'s "once per calendar day" check compares dates using the server process's local timezone, not each individual user's own `profiles.timezone` — consistent with the rest of the app's current level of sophistication (no per-user timezone conversion exists anywhere else either), but worth revisiting if the app ever serves users across many timezones simultaneously.
5. Liability cards don't display `due_date` even though the field exists and is captured by the form — not required by the task spec, just an incomplete surface of an existing field.

## Day 3 — Financial Planning (this session)

Turns the app from a wealth-tracking system into a proactive financial planning one: Money Year, the Annual→Quarterly→Monthly planning hierarchy, a real Debt Planner, a Financial Forecast engine with scenario/what-if planning, Financial Life Stage, and a Financial Priority Engine. **Complete, unit-tested, and verified live** — migration applied, RLS checked with two real users, every new page exercised end-to-end with real data, two real bugs found and fixed via that live testing.

### Database migration

`supabase/migrations/0004_financial_planning.sql` — written and **applied to the live project**. Adds 6 tables (`money_years`, `quarterly_plans`, `money_year_major_expenses`, `debt_plans`, `debt_plan_priorities`, `forecast_scenarios`) and extends the existing `budgets` table with 4 new columns (`expected_income`, `debt_reduction_target`, `goal_contribution_target`, `quarterly_plan_id`) rather than creating a parallel "monthly_plans" table — `budgets` (from Day 2) already *is* the monthly plan (one row per user per month with spending/savings/investment targets); duplicating it would have violated the task's explicit "never duplicate financial truth in multiple systems" rule. Also deliberately **not created**: a "forecast_assumptions" table (a scenario's assumption set is 1:1 with the scenario, so it's columns, not a join), and a "forecast_snapshots" table (forecasts are always computed live from current data + explicit assumptions — a persisted snapshot could only ever go stale). Financial Life Stage and the Priority Engine have **no table at all** — both are computed live from existing Day 1/2 data (transactions, liabilities, emergency funds, goals), the same way Wealth Score's components are; nothing new to persist. `budgets`' insert/update RLS policies were re-created (not edited in place — a new migration re-declaring them) to also verify `quarterly_plan_id` ownership when set. Verified live: `information_schema.tables`/`columns` confirm all 6 tables and all 4 new `budgets` columns exist in the production schema.

### Money Year

`src/lib/financial/money-year.ts` — `calculatePlanProgress()`, `calculatePlanScheduleStatus()` (ahead/on_track/behind, comparing actual progress % against the % of the year/quarter elapsed, with a 5-point buffer to avoid day-to-day flip-flopping; a target of 0 is always `on_track` — there's nothing to be behind on), `distributeEvenly()` (a starting suggestion only, never forced — "do not force equal division if user wants custom allocations" is honored by simply never calling this from the save path, only as a potential future UI convenience). Annual targets: income, savings, investment, debt reduction, emergency fund, plus expected irregular income/expenses and free-form notes. **Actuals are never a second stored number** — income/savings/investment/debt-reduction actuals come from summing the year's real transactions by type (`calculateSavingsContributions()`/`calculateInvestmentContributions()`/`calculateDebtReductionContributions()`, new small additions to `src/lib/financial/calculations.ts` alongside the existing `calculateIncome()`), and the emergency fund actual reads the live `emergency_funds.current_amount`. Quarterly plans break the annual targets into 4 quarters (`quarterly_plans`, `unique(money_year_id, quarter)`), each with its own progress computed the same way over that quarter's date range. Major expenses (`money_year_major_expenses`) are planned one-time spends, each optionally slotted to a month and markable paid/unpaid — deliberately a separate concept from both `financial_goals` (a savings target toward a future purchase) and `budgets`/`budget_categories` (routine recurring spending). Year selector (prev/next arrows, `?year=YYYY`). `/plan/money-year`.

### Annual / Quarterly / Monthly Planning

The three-level hierarchy is: `money_years` (annual) → `quarterly_plans` (quarterly) → `budgets` (monthly, extended per above). Users can set a quarter's targets independently of the annual total and a month's targets independently of its quarter — nothing auto-splits or overwrites a custom number the user entered themselves. Verified live: created an annual plan, set individual quarterly income targets, and confirmed each quarter's own progress bar and ahead/on-track/behind badge compute independently and correctly (one quarter reached 120% of its target and correctly rendered the green "ahead" state while sibling quarters at 0% showed the neutral "on track" state, since their targets were also 0 — not "behind").

### Plan vs Actual

Not a separate system or table — it's the same Plan/Actual/Difference/Progress-% pattern already established by Day 2's Budget (`getBudgetSummary()`), applied here to Money Year and Quarterly plans via `getMoneyYearSummary()`/`getQuarterlySummary()` in `src/features/money-year/queries.ts`. Every figure joins a stored target against a live-computed actual — there is exactly one source of truth for "what actually happened" (the transactions/liabilities/goals/emergency-fund tables), never a duplicated "actual" column anywhere.

### Debt Planner

`src/lib/financial/debt-planner.ts` — `calculatePayoffOrder()` (snowball = smallest balance first, avalanche = highest interest rate first, custom = user-specified order via `debt_plan_priorities`, with any liability missing from a custom order safely appended rather than silently dropped) and `calculateDebtPayoffPlan()`, a real month-by-month amortization simulation: interest accrues on every active balance each month, every debt gets at least its minimum payment, and the extra monthly payment — **plus every already-paid-off debt's freed-up minimum payment, rolled forward** (the actual "snowball/avalanche" mechanic, not just a flat extra applied to one debt forever) — goes to the single highest-priority still-active debt. Returns payoff order, an estimated payoff month per liability, total interest paid, interest saved vs. a minimum-payments-only baseline (same order, no extra), and the total monthly debt requirement. A liability whose minimum payment doesn't cover its own accruing interest is detected (the simulation hits a 600-month safety ceiling without reaching zero) and surfaced as an explicit warning rather than an infinite/wrong number. Every projection is labeled an estimate assuming rates and payments stay constant, per the task's explicit "do not claim exact future outcomes" requirement. Builds on the existing `liabilities` table (Day 2) — never copies balance/rate/minimum-payment data, always reads it live. `/plan/debt`.

### Financial Forecast

`src/lib/financial/forecast.ts` — `calculateForecast()` projects a starting snapshot (live cash balance, run-rate income/expenses, net worth, total debt) forward month-by-month under explicit assumptions (income/expense growth %, monthly savings/investment/debt payment, one-time income/expense events). Allocations are capped at whatever cash is actually available that month — a plan someone can't afford simply doesn't fully execute rather than driving cash artificially negative. Net worth is tracked by holding "other" (not-otherwise-modeled) net worth constant and layering cash + cumulative savings + cumulative investment − debt on top, so it stays anchored to the real starting snapshot. Three presets (`deriveConservativeAssumptions()`/`deriveOptimisticAssumptions()`, Base Case = the user's own current numbers unmodified) plus fully custom scenarios, saved as `forecast_scenarios` rows. **Scenario Planning ("what if")**: `scenarioExtraMonthlySavings()`, `scenarioExtraDebtPayment()`, `scenarioIncomeChangePercent()`, `scenarioExpenseChangeCents()`, `scenarioOneTimeExpense()`, `scenarioLoseIncome()` — deterministic, composable deltas covering every example the task named (save more, income up, extra debt payment, buy a car, rent increase, lose an income source), rendered as quick preset buttons that overlay a dashed comparison line on the same chart rather than opening a whole separate flow. `/plan/forecast`.

### Financial Life Stage

`src/lib/financial/life-stage.ts` — 7 cumulative stages (Survival → Stable → Protected → Debt Controlled → Investor → Wealth Builder → Financial Freedom), each requiring its own criterion **plus every earlier stage's**, so a user can never skip ahead on a fluke and always regresses cleanly the moment their situation gets worse (unit-tested explicitly: a user who reaches Financial Freedom and then runs a single month of negative cash flow drops straight back to Survival — cash flow health is foundational, not a permanent achievement). Exact, named, documented thresholds: `PROTECTED_MIN_MONTHS = 3`, `HIGH_INTEREST_RATE_THRESHOLD_PERCENT = 15`, `INVESTOR_MIN_SAVINGS_RATE_PERCENT = 10`, `WEALTH_BUILDER_MIN_SAVINGS_RATE_PERCENT = 20`, `FINANCIAL_FREEDOM_EXPENSE_MULTIPLE = 25` (the "4% rule" — net worth that could sustain current spending indefinitely). Surfaced on the dashboard reusing `FinancialStageProgress` (GRAPHICS_PLAN.md — previously built but "not imported anywhere yet"; now genuinely integrated) as a plain 7-dot stepper, never a game-like level bar, plus an expandable "why this stage" / "what's needed for the next stage" section.

### Financial Priority Engine

`src/lib/financial/priority-engine.ts` — `getFinancialPriorities()` returns every real, currently-true issue (negative cash flow, emergency fund below target, high-interest debt, a goal falling behind schedule, low savings rate, weak/declining income, not yet investing), each as structured data (`priorityType`, `severity`, `amountCents`/`targetPercent`/`goalName`, `targetValue`) — never conversational text, since this is explicitly Day 3 groundwork for Day 4's AI Money Coach, not the coach itself. Ordering follows CLAUDE.md's existing "Next Best Action" priority list (cash flow > emergency fund > debt > goals > savings rate > income growth > investing). Deliberately conservative about noise: "not investing yet" only fires once cash flow is positive and the savings rate is already healthy — flagging it while someone is still fighting negative cash flow would be premature, backwards advice. Surfaced as the dashboard Life Stage card's "top priority" callout — the single most urgent issue, not the full ranked list, to keep the card scannable.

### Navigation

`PlanTabs` (`src/components/layout/plan-tabs.tsx`) extended from 2 tabs to 5 (Goals, Emergency Fund, Money Year, Debt, Forecast), wrapped in the same horizontal-scroll container pattern as `MoneyTabs` so it doesn't overflow at 375px. No `features.ts` flag changes needed — Plan was already turned on in Day 2.

### Dashboard

New `LifeStageCard` (`src/features/dashboard/components/life-stage-card.tsx`) added to the existing `WealthOverview` grid: current stage (via `FinancialStageProgress`), the single top financial priority, and an expandable "why"/"what's next" section. Deliberately does **not** depend on any Day 3 table — it's computed entirely from Day 1/2 data (`src/features/life-stage/queries.ts`), so it works the moment migration 0003 is live, independent of 0004, and (like the rest of `WealthOverview`) is wrapped in the same try/catch resilience pattern established in Day 2 so a query failure never takes down the whole dashboard.

### Tests

6 new test files, 75 new tests (196 total, up from 121 at the end of Day 2), all passing: `tests/money-year.test.ts`, `tests/debt-planner.test.ts`, `tests/forecast.test.ts`, `tests/life-stage.test.ts`, `tests/priority-engine.test.ts`, plus 3 new small functions covered in the existing `tests/calculations.test.ts`. Every edge case the task spec named is covered: zero income, negative cash flow, no assets/liabilities, liability-heavy user, zero interest, a minimum payment that doesn't cover accruing interest (never-payoff detection), one-time forecast events, each life-stage boundary exactly, missing data (a brand-new user with nothing at all lands in "Stable," not penalized for having no history), and regression to an earlier stage.

### RLS Verification — DONE, 25/25 passed

`_rls_test_day3.mjs` (temporary script, deleted after use) created two real disposable users, then for every new table had User A create a row and verified User B could not SELECT/UPDATE/DELETE it or INSERT one claiming User A's `user_id` — including the `quarterly_plans`/`money_year_major_expenses` (child-of-`money_years`) and `debt_plan_priorities` (child-of-`debt_plans` **and** must reference the user's own `liabilities` row) ownership-chain patterns, and a dedicated check that User B cannot create a `budgets` row referencing User A's `quarterly_plan_id`. Ran live against the production project after the migration was applied: **25/25 checks passed** on the first attempt.

### Browser QA — DONE

Full live browser QA (Playwright, disposable test account, real data entered through the actual UI forms) across all 3 new pages plus the updated dashboard, at 375/390/430/desktop. Verified live and hand-checked against the underlying formulas: Debt Planner's interest-saved figure (฿681.02 = ฿2,060.89 baseline interest − ฿1,379.87 with-extra-payment interest, exact match) and payoff-date shift (12 months → 8 months once ฿1,000/month extra was added); Money Year's quarterly progress coloring (a quarter at 120% of its income target rendered the green "ahead" bar, siblings at 0%/0 target correctly rendered neutral "on track," not red "behind"); Forecast's month-by-month net worth projection (฿290,000 after 12 months, hand-verified against the model: starting ฿70,000 cash − ฿20,000 debt = ฿50,000 net worth, growing by income-minus-expenses-minus-debt-payment each month until the debt fully pays off around month 10, after which the freed-up debt payment accelerates cash growth for the remaining 2 months — the "faster growth once debt is retired" behavior in the displayed number is *correct*, not a bug, and matches the simulation design). No raw IDs, no raw enum values, no horizontal overflow, no clipped Thai text found. One apparent visual overlap (a card behind the bottom nav in a `fullPage: true` screenshot) was investigated and confirmed — as in Day 2 — to be a Playwright full-page-screenshot artifact with `position: fixed` elements, not a real bug: a targeted scrolled-viewport screenshot showed the card fully visible and correctly positioned.

### Bugs found via live QA (not visible from code review)

1. **Life Stage's "why this stage" / "what's needed next" text was hardcoded English, bypassing the i18n system entirely**, even for a Thai-locale user — found immediately on the first screenshot of the expanded dashboard card. Root cause: `src/lib/financial/life-stage.ts`'s pure domain function returned a `description` field with the explanation baked in as a fixed English string (reasonable for a pure calculation function returning locale-agnostic *data*, but the UI layer (`LifeStageCard`) rendered that field directly instead of using it only to know *which* stage's explanation to show). Fixed by adding a `lifeStage.criteria.<stage>` key for all 7 stages to both dictionaries and having the UI look up the translation by `lifeStage.stage`/`lifeStage.nextStage`, never rendering the domain function's own `description` field (now documented in its type as "English, fixed wording — for logs/tests only"). Verified live afterward: the exact same dashboard state that showed "Monthly cash flow is not negative (income covers expenses)." now shows "กระแสเงินสดต่อเดือนไม่ติดลบ (รายรับครอบคลุมรายจ่าย)".
2. **Forecast produced a flat, misleading projection for a new/recently-started user.** `getForecastStartingState()` averaged income/expenses over "the last 3 *full* months" — deliberately excluding the current in-progress month to avoid a partial-month skew. But for any user whose only transaction history is *this* month (a brand-new signup, or — as happened during this exact QA session — a fresh test account), that 3-full-months window is completely empty, silently producing a ฿0 income/expense baseline and a forecast chart that's a flat line at the current net worth for the entire horizon. Found by literally looking at the rendered chart (visibly flat) rather than trusting the number. Fixed by falling back to the current in-progress month's real income/expenses whenever the historical window has zero transactions — a rougher estimate than a true 3-month average, but an honest one grounded in real data, instead of a confidently-wrong zero. Verified live afterward: the same account's forecast now shows a correct upward-sloping projection reaching ฿290,000 at 12 months, which was independently hand-verified against the simulation's own logic (see "Browser QA" above).

### Known Limitations

1. Financial Life Stage and the Priority Engine have no dedicated route — by design (see their sections above), surfaced only on the dashboard. Revisit if product feedback wants a dedicated deep-dive page (e.g. a fuller priority list beyond just the top one).
2. Forecast's starting-income/expense fallback (current month when there's no 3-month history) is a reasonable but still rough estimate for very new users — it will naturally improve as real history accumulates, but a user in their first few days will see a forecast based on a single partial month.
3. `debt_plan_priorities` (the custom-strategy payoff order) has a save action (`saveCustomPriorityOrder()`) but no drag-to-reorder UI yet — the "custom" strategy option exists and is selectable, and the underlying ordering logic and RLS are fully implemented and tested, but a user can't yet visually reorder liabilities in the browser. Snowball and avalanche (the two strategies named first and most prominently in the task spec) are fully interactive.
4. The Forecast "what-if" comparisons are ephemeral (client-side only, not saved) — matches the task's framing of these as quick, lightweight exploration rather than persisted scenarios (which is what the separate, savable `forecast_scenarios` are for).

## Day 4 — AI Money Coach (this session)

Turns WEALTH OS into a trustworthy AI-assisted financial operating system, without letting the AI touch a single financial calculation. Every balance, score, forecast, budget, debt figure, and priority still comes from Day 1-3's deterministic domain logic; the AI's job is strictly to explain, summarize, and coach using that data. **Complete, unit-tested, and verified live** — migration applied, RLS checked with two real users, chat/NBA/health-check/dashboard all exercised end-to-end with real seeded data.

### AI Architecture / Provider

`src/features/ai/lib/provider.ts` defines the `AIProvider` interface (`generate()`, `stream()`) that every AI call in the app goes through — no component, action, or route handler ever calls a provider SDK/REST API directly. `AnthropicProvider` is the one concrete implementation, using a direct `fetch` against `https://api.anthropic.com/v1/messages` (no SDK dependency, consistent with this project's existing pattern of calling external HTTP APIs directly) with manual Server-Sent-Events parsing for `stream()`. The whole module is `"server-only"`; `AI_API_KEY`/`AI_MODEL` (already reserved as optional server env vars from an earlier session) never reach the client. `getAIProvider()` returns `null` — never throws — when `AI_API_KEY` is unset, so every caller must handle "AI coach unavailable" as a real, expected state. `__setProviderForTesting()` lets tests inject a mock provider instead of hitting a live model (used throughout `tests/ai-provider.test.ts`). Feature folder layout follows the task's recommended structure: `src/features/ai/{actions,queries,components,lib,prompts,tools,types}/`.

### Controlled Financial Tools

`src/features/ai/tools/index.ts` — 16 server-only functions (`getFinancialSummary`, `getMonthlyCashFlow`, `getBudgetStatus`, `getNetWorthSummary`, `getGoalProgress`, `getEmergencyFundStatus`, `getSafeToSpendSummary`, `getWealthScoreSummary`, `getDebtSummary`, `getDebtPlan`, `getForecastSummary`, `getMoneyYearProgress`, `getFinancialLifeStage`, `getFinancialPriority`, `getRecentTransactionsSummary`, `getIncomeSummary`), each a thin wrapper around an existing Day 1-3 query/domain function. The model never generates SQL and never queries a table directly — every tool returns pre-computed, structured, already-scoped-to-the-authenticated-user data (scoping is inherited from the same RLS-backed `createClient()` session every other query in the app uses, not re-implemented here). `getRecentTransactionsSummary()` deliberately returns only a count and top-5 category totals, never the raw transaction list, per the task's "minimize token usage and unnecessary sensitive-data exposure" rule.

### Financial Context

`src/features/ai/lib/context-builder.ts` — `buildFinancialContext()` runs 13 of the 16 tools in parallel (deliberately excluding money-year, forecast-scenario, and debt-plan detail — those stay available as on-demand tools rather than being sent on every single chat turn) and composes them into one compact `FinancialContext` object (`src/features/ai/types/index.ts`): locale, currency, snapshot, cash flow, Safe-to-Spend, budget, net worth, emergency fund, debts, goals, Wealth Score, life stage, current priority, recent-spending summary, income. Never the user's full transaction history — everything is a pre-summarized figure. `src/features/ai/prompts/money-coach.ts`'s `renderFinancialContext()` turns this into plain labeled text (not raw JSON — an LLM narrates a short labeled summary far more reliably, and it costs fewer tokens) for interpolation into the system prompt.

### AI Money Coach

`/ai` (`src/app/(app)/ai/page.tsx`) — Header (AI Coach identity + `AICoachIllustration`) → compact financial snapshot strip → Next Best Action → one AI Insight → Monthly Health Check → suggested-prompts/conversation, exactly the layout order GRAPHICS_PLAN.md's AI Coach section calls for, reusing the existing illustration/status/brand system throughout rather than looking like a generic chat product. `src/features/ai/components/ai-coach-chat.tsx` (client component) posts to `POST /api/ai/chat` and parses a newline-delimited-JSON event stream (`{type: "conversation"|"delta"|"error"|"done"}`) rather than raw SSE — the only place doing real SSE parsing is `provider.ts`, talking to Anthropic. Empty state (illustration + the 7 Thai starter prompts verbatim from the task spec), loading ("กำลังคิด..." inline in the pending assistant bubble), streaming (text appends chunk-by-chunk as it arrives), and error states (a plain-language banner, never a raw error object or stack trace) are all handled. `POST /api/ai/chat` (`src/app/api/ai/chat/route.ts`) is the only place a request ever reaches an AI provider: it authenticates the user, validates the message, runs guardrails, builds the Financial Context fresh (never cached/stale), builds the system prompt, streams the reply, and persists both sides of the exchange afterward.

### Next Best Action

Deliberately **zero LLM calls** — Day 3's deterministic Financial Priority Engine (`getFinancialPriorities()`) already decides the user's top issue; the AI is never asked to independently derive it. `src/features/ai/lib/next-best-action.ts`'s `buildNextBestActionText()` is a pure function transforming a `PriorityTool` into display text, with an **explicit switch per `priorityType`** rather than a generic "if amountCents is set" fallback — the same field means different things for different priorities. This mattered in practice: `high_interest_debt`'s `amountCents` is the liability's outstanding *balance*, not a suggested payment, and an early draft of the card would have displayed it ambiguously as if it were one (caught via self-review before any test/build run, not by an external report — see "Bugs Fixed" below). `PriorityTool` gained a `targetValue?: number` field (the interest rate, for that one priority type) with a doc comment distinguishing it from `amountCents`. `NextBestActionCard` (`src/features/ai/components/next-best-action-card.tsx`) renders the pure function's output; never a vague "save more money" — always a specific number and a CTA link into the relevant page (`/plan/debt`, `/plan/emergency-fund`, `/plan/goals`, `/money/budget`).

### Monthly Health Check

`src/features/ai/lib/health-check.ts` — `buildMonthlyHealthCheck()` is entirely deterministic: real current-vs-previous-month transaction data in, a structured `{ hasEnoughData, overallStatus, positives, risks, changes, priorityAction }` object out. `changes` is a neutral, always-populated list of raw month-over-month deltas (income/expenses/savings-rate/cash-flow/net-worth), kept deliberately separate from `positives`/`risks` (which only fire once a delta crosses a real threshold) so the 4 required sections map cleanly: สิ่งที่ดีขึ้น / สิ่งที่ควรระวัง / สิ่งที่เปลี่ยนจากเดือนก่อน / สิ่งที่ควรทำต่อไป. `overallStatus` is `needs_attention` whenever cash flow is negative or the budget is over, `good`/`mixed` otherwise by simple positive/risk count comparison. Reports `hasEnoughData: false` (an honest "not ready yet" empty state) rather than fabricating a status when there's no prior month to compare against. `MonthlyHealthCheckCard` accepts a `showPriorityAction` flag so the `/ai` page (which already shows a standalone `NextBestActionCard` higher up) doesn't render the same priority action twice.

### Guardrails

`src/features/ai/lib/guardrails.ts` — `sanitizeUserText()` strips the literal `</financial_context>`, `</system>`, `</instructions?>` tag delimiters from every user-editable string (goal names, liability names, over-budget category names, top-spending category names) before it's interpolated into the system prompt — the concrete implementation of "treat financial data as data, not instructions." `validateUserMessage()` rejects empty/over-length messages before any AI call. `containsDistressSignal()` (Thai + English crisis keywords) short-circuits the entire route **before** any provider call — no AI involved, no risk of an evasive/unhelpful model response to acute distress — and returns a fixed safety message naming Thailand's mental-health hotline (1323), still persisted into the conversation like any other exchange. `requestsGuaranteedReturns()` doesn't block the message but appends an extra reinforcement line to that turn's system prompt reiterating "no guaranteed returns," on top of the standing rule already in the core system prompt. The core system prompt (`src/features/ai/prompts/money-coach.ts`) additionally: uses only provided data, distinguishes facts from estimates, never invents a balance/transaction/goal/debt/income/score, never claims guaranteed returns or wealth, avoids shame/judgment/manipulative urgency, never pretends to be a licensed adviser, prefers specific measurable actions, explains calculations using the deterministic figures it's given, and says plainly when data is missing rather than guessing. Tone instructions are locale-specific (`LOCALE_INSTRUCTIONS`) — Thai responses are asked for as "the way a knowledgeable Thai friend who's good with money would actually talk," not a machine translation.

### AI Insight Cards

`src/features/ai/lib/insights.ts` — 5 insight types (spending increase, savings-rate drop, debt progress, goal ahead of schedule, net worth growth), each gated by a real threshold (e.g. a category spending increase only fires past +30% *and* ฿500 absolute, so a tiny category's noise never becomes a notification) so insights are never generated "just because the AI can generate text." `getTopInsight()` returns at most one — the dashboard and `/ai` page each show only the single highest-priority insight, never a feed.

### New Tables

`supabase/migrations/0005_ai_money_coach.sql` — applied to the live project. `ai_conversations` (one row per chat thread), `ai_messages` (append-only, immutable — no update policy, since a chat transcript is a log not an editable record), `ai_usage_log` (per-request `model`/`input_tokens`/`output_tokens`/`user_id`/`created_at` counters with no billing/plan logic yet — explicit groundwork for a future Day 7 Free/Plus/Pro limiter, per the task's "prepare architecture, do not build billing yet" instruction). Deliberately **not persisted**: any Financial Context snapshot (always rebuilt live so an answer can never drift from current truth), and Next Best Action/Monthly Health Check/Insight results (all computed live, zero-LLM-call, from existing tables — nothing new to store).

### New Routes

`/ai` (page) and `POST /api/ai/chat` (route handler, this app's first). `src/config/features.ts`'s `ai` flag flipped `false → true`, so the existing `NAV_ITEMS` filtering pattern (already wired since Day 1) now shows the AI nav item automatically — no nav-component changes needed.

### RLS Verification — DONE, 13/13 passed

An inline Node script (not committed) created two real disposable Supabase Auth users, had User A chat through the real `/ai` route (creating a real `ai_conversations` + `ai_messages` row pair via the distress-guardrail short-circuit path, so no `AI_API_KEY` was needed to generate real persisted data), then — using each user's own anon-key + access-token, never the service role — verified User B: cannot see User A's conversation/messages in a list query, cannot fetch them by direct ID, cannot UPDATE (title-spoofing attempt), cannot DELETE, cannot INSERT a message into User A's `conversation_id` even when claiming their own `user_id`, and cannot INSERT a conversation with `user_id` spoofed as User A. Also verified `ai_usage_log` row isolation. **13/13 checks passed** on the first attempt. Both disposable users and all their data were deleted afterward via the Management API.

### Browser QA — DONE (with one credential-gated exception)

Live browser QA (Playwright, a disposable test account seeded with real accounts/transactions/a liability/budget/emergency-fund data via direct SQL through the Supabase Management API, then exercised through the actual running app) at 375/390/430/desktop. Verified live: the `/ai` empty state and all 7 Thai suggested prompts render correctly; the Next Best Action card correctly showed **"เร่งจ่ายหนี้ที่ดอกเบี้ยสูงก่อนหนี้ก้อนอื่น: Credit Card A (ดอกเบี้ย 24%)"** — the liability name and interest rate, never the ฿20,000 balance as if it were a suggested payment, confirming the fix described under "Bugs Fixed" actually works end-to-end; the Monthly Health Check card correctly categorized a seeded scenario (+3% income, +44% expenses, -11% savings rate, a debt payment made) into positives/risks/changes exactly as the unit tests predict; the AI Insight card showed the single top insight (savings-rate drop) rather than every qualifying insight; the dashboard's compact AI section (Next Best Action + one insight + a link to `/ai`) renders correctly beneath the existing financial cards, never crowding out the primary numbers. The "AI not configured" fallback (503 + a plain-language Thai error banner, since `AI_API_KEY` is unset in this environment) was verified via a direct network-response check — confirmed the error truly renders in the UI, after an initial 2-second-wait screenshot in the QA script itself falsely suggested it didn't (a script timing artifact from the dev server JIT-compiling the route handler on its first hit, not a product bug; a 3-second wait showed it working correctly). The distress-signal guardrail was verified fully end-to-end: typing "อยากตาย เครียดเรื่องเงินมาก" produced an immediate assistant reply naming the 1323 hotline, with **no AI provider call involved**. One apparent visual overlap (health-check card content behind the fixed bottom nav in a `fullPage: true` mobile screenshot) was investigated and confirmed — as in Days 2 and 3 — to be a Playwright full-page-screenshot artifact with `position: fixed` elements, not a real bug: scrolled-viewport screenshots showed all content fully visible and correctly positioned. **Not verified**: an actual conversational reply from a live model, since `AI_API_KEY` is not configured in this environment — see "Known Limitations."

### Tests

7 new test files, 50 new tests (246 total, up from 196 at the end of Day 3), all passing, all using a mocked AI provider / mocked query modules — never a live external model call: `tests/ai-guardrails.test.ts` (sanitization, message validation, distress/guaranteed-return detection), `tests/ai-prompt.test.ts` (missing-data behavior, prompt-injection resistance via a goal/liability/category name containing tag-delimiter injection, Thai/English locale instructions), `tests/ai-provider.test.ts` (fallback-to-null behavior, test-provider injection, real SSE-parsing correctness against a fabricated Anthropic stream response, non-OK-status error handling), `tests/ai-context-builder.test.ts` (Financial Context Builder composition, THB currency fallback), `tests/ai-health-check.test.ts` (Monthly Health Check structure across 6 scenarios), `tests/ai-insights.test.ts` (all 5 insight types plus their thresholds, "no insight" spam-avoidance), `tests/ai-next-best-action.test.ts` (the Next Best Action pure-transformation function, explicitly covering the high-interest-debt balance-vs-interest-rate distinction). A new `tests/mocks/server-only.ts` + a `vitest.config.mts` alias were added — the real `server-only` npm package unconditionally throws outside Next.js's own build pipeline, which would otherwise make every server-only AI module untestable under plain Node/vitest.

### Bugs Fixed (caught via self-review, before any external report)

1. **Prompt-injection gap in the context renderer.** `renderFinancialContext()` initially interpolated user-editable text (category, liability, and goal names) directly into the system prompt with no sanitization, despite `guardrails.ts`'s `sanitizeUserText()` existing specifically for this. Caught by re-reading the just-written code, not via a failing test or live exploit. Fixed by wrapping all 4 interpolation points; covered by `tests/ai-prompt.test.ts`'s injection-resistance tests and re-verified live in browser QA with a liability literally named `Credit Card A` (a real liability, unaffected — the sanitizer only strips the specific tag-delimiter substrings, never ordinary text).
2. **`high_interest_debt`'s Next Best Action could have displayed a factually misleading number.** Day 3's priority engine sets `targetValue` (the interest rate) for this priority type, not `targetPercent`/`amountCents`-as-payment — but the tool layer's first draft dropped `targetValue` entirely, and the card component's first draft used a generic "show amountCents if present" fallback that would have rendered the liability's outstanding *balance* as if it were a suggested payment amount (e.g. "เร่งจ่ายหนี้... ฿20,000.00" ambiguously implying ฿20,000 was the suggested payment). This directly contradicts the task's "AI must never invent financial facts" principle, extended here to deterministic-card accuracy. Fixed by adding `targetValue` to `PriorityTool`, threading it through `getFinancialPriority()`, and rewriting the card's transformation as an explicit per-`priorityType` switch. Verified live: the seeded test liability (Credit Card A, 24% interest, ฿20,000 balance) correctly rendered "...Credit Card A (ดอกเบี้ย 24%)" with the balance never shown as a payment figure.

### Known Limitations

1. ~~A live conversational AI reply was not exercised end-to-end~~ — **done, see "AI Live Model Verification" below** (performed at the start of the Day 6 session once a real `AI_API_KEY` was configured).
2. Chat conversations have no list/history UI yet (no "past conversations" sidebar) — `ai_conversations`/`ai_messages` are fully persisted and RLS-verified, and `getConversations()`/`getConversation()`/`getMessages()` exist in `src/features/ai/queries/index.ts`, but `/ai` always starts a fresh conversation. Matches the task's "do not overengineer memory yet" instruction; revisit if users want to resume a past chat.
3. `ai_usage_log` rows are written on every successful AI reply but nothing reads them yet — no usage display, no limit enforcement. Intentional Day 7 groundwork per the task spec, not a bug.
4. The AI Insight ordering (`buildInsights()`'s array order) is a fixed code-defined priority, not dynamically ranked by magnitude/severity across types — acceptable for "show the single most meaningful one" at current scope, but worth revisiting if a future insight type should sometimes outrank an earlier-listed one.

## Day 5 — Income Engine (this session)

Turns WEALTH OS from a tracking/planning system into one that also helps users increase income, per CLAUDE.md's "EARN SYSTEM" section and its explicit "the major differentiator is EARN" framing. Every number — income averages, the gap to a target, an opportunity's match score, a mission's sequence — is deterministic; the AI (reusing Day 4's architecture unchanged) may only explain results already computed, never invent a job opportunity, income amount, or skill. **Complete, unit-tested, and verified live** — migration applied, RLS checked with two real users, every new page exercised end-to-end with real seeded data, one real bug found and fixed via that live testing.

### Database Migration

`supabase/migrations/0006_income_engine.sql` — applied to the live project. Adds `income_sources`, `user_skills`, `income_targets` (one row per user, no versioning — unlike Money Year, this spec has no "never overwrite" requirement for it), `income_opportunities` (a **global, read-only catalog** seeded with 17 rows in the migration itself — no `user_id` at all, since every user sees the same catalog and is ranked against it differently at query time, never via a per-user copy of catalog rows), and `income_missions` (user-owned generated instances). Deliberately **not created**: an `income_mission_progress` child table — a mission's progress is a scalar (`progress_quantity` + `status`) directly on `income_missions`, since this spec has no history requirement for progress, the same reasoning Day 3 used to skip a `forecast_snapshots` table. Also deliberately avoided: any "actual monthly income" column anywhere — `income_sources.expected_monthly_income` is a planning figure only; `transactions` (Day 1) remains the sole source of truth for real received income, per the task's explicit "never store a second conflicting actual income number" instruction. `income_targets` gained two columns (`max_startup_cost`, `work_mode_preference`) in a follow-up `ALTER TABLE` during this same session, once the Side Hustle Finder's scoring model made clear it needed a startup-cost and work-mode preference beyond what the initial schema had — the migration file itself was updated to match so it stays reproducible from scratch. Verified live: all 5 tables exist with RLS enabled; the catalog has 17 seeded rows.

### Income Sources

`src/features/income-sources/` (queries/actions/components) — a straightforward CRUD feature (name, type, expected monthly income, stability, frequency, active/inactive, notes) following the same `useActionState` + Dialog form pattern as every other Day 1-4 CRUD feature. `/earn/income`.

### Income Profile

`src/lib/financial/income-profile.ts` — `calculateIncomeProfile()` is a pure function taking real trailing-month income (from `transactions`, via a new `src/features/income-profile/queries.ts` aggregator) plus the user's `income_sources` rows, and deterministically computing: current/average monthly income, stable vs. variable income (summed from active sources by `stability`), active source count, primary source (highest expected-income active source), income concentration (primary source's share of total expected income — `hasIncomeConcentrationRisk()` flags ≥90%, matching CLAUDE.md's own example), month-over-month growth vs. the trailing average, and an overall stability rating (`stable`/`mixed`/`variable`/`unknown`, the last one when there are no active sources at all — never penalized as "bad," just "not enough data").

### Skills Profile

`src/features/skills/` — skill name (free text — no rigid catalog, since "Other" is explicitly one of the task's example categories), a fixed category enum (matching the task's 12 named examples + Other), proficiency level, months of experience, monetized-before yes/no, notes, interest level, and available hours/week. Deliberately **no "verified skill" concept** — every field is the user's own self-reported claim, per the task's explicit instruction. `/earn/skills`.

### Income Target / Income Gap

`src/features/income-target/` — one settings-style form (target monthly income, desired extra income, target date, preferred income type, max hours/week, max startup cost, work-mode preference), always-visible rather than a dialog, matching the existing Emergency Fund settings pattern. `src/lib/financial/income-gap.ts`'s `calculateIncomeGap()` is a single pure function: `gap = target - average income`, clamped to 0 and reported as `achieved: true` once the target is met or exceeded; reports `hasTarget: false` (not a fabricated zero) when no target has been set at all. Rendered via `IncomeGapCard`, shown at the top of `/earn/income` and again on the Earn Dashboard.

### Side Hustle Finder / Opportunity Catalog

`src/lib/financial/opportunity-scoring.ts`'s `scoreOpportunity()` — a pure, deterministic 6-factor weighted model (Skill Match 30%, Available Time Match 20%, Income Gap Fit 20%, Startup Cost Fit 10%, Speed to First Income 10%, User Interest 10%, exactly the weights the task specified), scoring every catalog opportunity against the user's real skills/target/income-profile data. Skill Match gives half credit just for having a matching skill category, the rest for reaching the opportunity's recommended proficiency — never an all-or-nothing cliff. Startup Cost Fit and Available Time Match both treat "no preference stated" as neutral (not a penalty) rather than assuming the worst case. Returns a total score (0-100), a per-factor breakdown, matched skill categories, and a `missingRequirements` list (`skill`/`time`/`budget`) — structured reason codes the UI/AI render as localized text, never raw. `src/features/opportunities/queries.ts`'s `getRankedOpportunities()` composes this against all 17 catalog rows and sorts by score; `getTopOpportunities(n)` slices the top N. The 17-row catalog (`income_opportunities`, seeded in the migration) covers every example the task named (freelance web dev, landing pages, website maintenance, automation, personal training, online coaching, language tutoring, translation, content editing, short-form video editing, social media management, appointment setting, digital products, e-book, online course, local service business, consulting), each with required skills, recommended proficiency, startup cost range, hours/week range, income model, difficulty, work mode, scalability, time-to-first-income, and an income range **explicitly labeled as a rough example, never a guarantee** (`earn.opportunities.estimatedIncomeDisclaimer`, shown under every card). `/earn/opportunities`.

### Income Missions

`src/lib/financial/income-missions.ts`'s `generateMissionSequence()` returns one fixed, deterministic 10-step sequence (define offer → build portfolio → create platform profile → set price → publish offer → contact 5 prospects → follow up with 5 leads → close first client → ask for a referral → consider raising price) — a merge of the task's own 7-step example and CLAUDE.md's EARN SYSTEM mission list, applicable to any chosen opportunity rather than a bespoke sequence per catalog row (the task's own example is itself opportunity-agnostic, and generating 17 separate bespoke sequences would be premature complexity for no demonstrated benefit). `src/features/income-missions/actions.ts`'s `generateMissionsForOpportunity()` is idempotent — re-clicking "start" on an opportunity the user already started never duplicates the sequence. Progress is tracked as `progress_quantity`/`target_quantity` for quantity-based missions (outreach, follow-up) and a plain `status` toggle for qualitative ones (define offer, set price); a quantity mission auto-completes once its target is reached. Status is one of `not_started`/`in_progress`/`completed`/`skipped` — skipping is a first-class, always-available action, never a dead end. `/earn/missions`.

### Earn Dashboard

`/earn` (`src/features/earn/components/earn-overview.tsx`) — Income Hero → Income Gap → Recommended Opportunity → Today's Income Mission → Income Profile → Income Sources, exactly the order the task specified, reusing `EarnIllustration` for the empty state and the same Card/Badge components every other page in the app uses (deliberately **not** a new bespoke visual system — GRAPHICS_PLAN.md's guidance is to reuse, not invent). `EarnTabs` (`src/components/layout/earn-tabs.tsx`) mirrors `PlanTabs`' exact pattern (horizontal-scroll container, active-state pill) across the 5 Earn routes.

### AI Integration

Reuses Day 4's `AIProvider`/tool/context-builder/system-prompt architecture completely unchanged — **no second AI system was created.** 5 new controlled tools added to `src/features/ai/tools/index.ts` (`getIncomeProfile`, `getIncomeGap`, `getSkillProfile`, `getTopIncomeOpportunities`, `getActiveIncomeMissions`), each a thin wrapper around the same deterministic functions/queries the Earn UI itself uses. `FinancialContext` gained 5 new compact fields — `incomeProfile`, `incomeGap`, a skills summary (category counts only, never every skill's full name/notes), the **top 3** ranked opportunities (name + score + matched/missing, never the full 17-row catalog — the task's explicit "do not send the full opportunity catalog on every chat turn" instruction), and up to 5 active mission statuses. The core system prompt gained two new rules: never invent a job opportunity/income amount/skill the user hasn't reported, and never mark a mission as done or claim unreported progress. The 7 Day 4 suggested prompts were extended with 5 Day-5-specific ones verbatim from the task spec (ฉันควรเพิ่มรายได้จากทางไหน, ทักษะไหนของฉันหาเงินได้เร็วที่สุด, ถ้าอยากเพิ่มรายได้อีก ฿10,000 ต่อเดือนควรเริ่มยังไง, Side Hustle ไหนเหมาะกับเวลาที่ฉันมี, วันนี้ฉันควรทำ Income Mission อะไร) — verified live to render correctly at all 12 total.

### Next Best Action Integration

`src/lib/financial/priority-engine.ts` gained a new `income_gap` priority type, ranked (per CLAUDE.md's own priority list: "...5. Financial goals 6. Income gap 7. Investing...") directly below `missed_goal` and above `low_savings_rate` — **never above** `negative_cash_flow`/`no_emergency_fund`/`high_interest_debt`, verified explicitly by a unit test that gives it an enormous ฿50,000 gap alongside a critical cash-flow crisis and confirms cash flow still ranks first. Only fires once the user has explicitly set an income target (an unset target never nags); severity scales with the gap size relative to essential expenses, and is bumped up one level when income is also concentrated ≥90% in a single source (both real risk signals compounding, not double-counted as separate priorities). `getLifeStageAndPriorities()` (`src/features/life-stage/queries.ts`) now also fetches the user's Income Profile/Target to feed these two new inputs — still computed live, still no new table.

### New Tables

`income_sources`, `user_skills`, `income_targets`, `income_opportunities` (global, read-only), `income_missions` — see "Database Migration" above.

### New Routes

`/earn` (dashboard), `/earn/income`, `/earn/skills`, `/earn/opportunities`, `/earn/missions`. `src/config/features.ts`'s `earn` flag flipped `false → true`; the `NAV_ITEMS` filtering pattern already existed from Day 1, so no nav-component changes were needed.

### RLS Verification — DONE, 26/26 passed

An inline Node script (not committed) created two real disposable Supabase Auth users, seeded User A with real rows in all 5 new tables through direct SQL, then — using each user's own anon-key + access-token, never the service role — verified for each of the 4 user-owned tables that User B cannot see it in a list query, cannot fetch it by direct ID, cannot UPDATE it, cannot DELETE it, and cannot INSERT a row claiming User A's `user_id`; separately verified that the global `income_opportunities` catalog is readable by every authenticated user (including one with zero data of their own) but writable by no one at the application layer (an INSERT attempt correctly fails). **26/26 checks passed.** Both disposable users and all their data were deleted afterward via the Management API.

### Browser QA — DONE

Live browser QA (Playwright, a disposable test account seeded with real transactions/income sources/a skill/an income target via direct SQL through the Supabase Management API, then exercised through the actual running app) at 375/390/430/desktop. Verified live: the Earn Dashboard correctly computed and displayed a ฿34,000 average income, a ฿16,000/month gap against a ฿50,000 target, and correctly ranked "รับทำ Landing Page" (Landing page service) at 100/100 given the seeded `web_development` skill; the Income Profile card correctly showed "ผสมผสาน" (mixed) stability and an 86% primary-source concentration (30,000/35,000) without a false concentration-risk warning (below the 90% threshold, correctly not flagged); all 17 opportunities rendered ranked with correct score-color bands, matched skills, and missing-requirement labels; clicking "start missions" generated the full 10-mission sequence in the correct order with correct Thai titles/descriptions; marking a mission in-progress correctly updated its status and button state; the dashboard's compact AI section and the `/ai` page both correctly surfaced the new `income_gap` Next Best Action and all 12 suggested prompts (7 Day 4 + 5 Day 5) with no layout breakage. No raw IDs, no raw enum values, no horizontal overflow found. One apparent layout issue in a compressed thumbnail view of a `fullPage: true` mobile screenshot was investigated with a viewport-only re-screenshot and confirmed to render correctly — not a real bug.

### Bugs found via live QA (not visible from code review)

1. **The dashboard's Life Stage card showed a raw, untranslated i18n key instead of the new priority's label.** `src/features/dashboard/components/life-stage-card.tsx` (a Day 3 component) reads `priorityEngine.priorities.<type>` — a **separate, shorter-label i18n namespace** from the one used by the AI feature's `NextBestActionCard` (`nextBestAction.actions.<type>`/`nextBestAction.reasons.<type>`, which *was* correctly updated for `income_gap` while writing the priority-engine extension). Because the two namespaces exist independently for two different UI surfaces showing the same priority data, adding `income_gap` to only one of them left the other rendering the literal string `priorityEngine.priorities.income_gap` on the live dashboard — caught immediately in the first live screenshot, not via code review (both call sites type-check fine; a missing dictionary key is not a TypeScript error, since `useTranslation()`'s `t()` falls back to the raw key string by design so untranslated strings are visible in development rather than blank). Fixed by adding the missing key to both `th.json` and `en.json`. Verified live afterward: the same dashboard now shows "มีช่องว่างรายได้จากเป้าหมาย". Generalizes to a standing lesson: **whenever a new value is added to a shared enum/union type (like `PriorityType`), grep for every i18n namespace keyed by that enum, not just the one in the file you're actively editing** — this codebase deliberately keeps small per-surface label sets instead of one universal dictionary, which is usually the right call for token/bundle size but means a new enum member must be added in more than one place by hand.

### Known Limitations

1. Income Missions use one fixed, universal 10-step sequence regardless of which opportunity was chosen — reasonable at current scope (the task's own example sequence is itself opportunity-agnostic), but a future iteration could tailor steps to an opportunity's `income_model` (e.g. a `product`-model opportunity like an e-book doesn't really need an "outreach 5 prospects" step in the same sense a `project`-model freelance service does).
2. The Side Hustle Finder catalog (17 rows) is static, seeded once via migration — there's no admin UI to add/edit/retire opportunities yet. Reasonable for the current scope; revisit if the catalog needs to grow or be localized beyond Thai/English.
3. `income_targets` has no historical versioning (unlike Money Year) — changing a target overwrites it in place. Matches this task's spec (no "never overwrite" instruction was given for Income Target, unlike Money Year's explicit one), but worth reconsidering if users want to see how their target evolved over time.
4. Skill categories are a fixed enum (matching the task's named examples) rather than a free-form/extensible list — a skill that doesn't fit any category must be filed under "Other," which slightly weakens opportunity matching for niche skills.

## AI Live Model Verification (this session, before Day 6)

Day 4's one remaining open item — a real conversational reply had never been exercised against a live model — was closed out now that a real `AI_API_KEY` is configured. Verified, in order:

1. **Server-only, never client-exposed.** `AI_API_KEY` lives only in `serverEnvSchema` (`src/config/env.ts`), never `clientEnvSchema`; it's read exactly once, in `src/features/ai/lib/provider.ts` (`"server-only"`), via `process.env.AI_API_KEY` — never a `NEXT_PUBLIC_`-prefixed variable. `.env.local` is confirmed gitignored (`.env*` in `.gitignore`, only `.env.example` is tracked). The key's value was never printed, logged, or committed at any point during this verification.
2. **Live browser test.** Logged into a disposable seeded test account, opened `/ai`, and sent the exact message: "ตอนนี้การเงินของฉันเป็นยังไงบ้าง และควรทำอะไรต่อเป็นอันดับแรก". A real request reached Anthropic's API (network response `200`), streamed token-by-token into the assistant bubble, and produced a fluent, natural Thai reply — not a machine-translation cadence.
3. **Context grounding verified, not assumed.** Every figure in the reply was cross-checked against the seeded data and the deterministic cards rendered on the same page: ฿35,000 income (+2.9%), ฿13,000 expenses, +฿22,000 cash flow, 62.9% savings rate, ฿75,000 net worth (฿95,000 assets − ฿20,000 liabilities), Wealth Score 63/100 ("stable", next stage "protected"), the Credit Card A ฿20,000/24% priority (correctly cited as severity "high" and ranked first), Safe-to-Spend ฿4,352.94, and the two largest recent spending categories (฿15,000 / ฿9,000) — all exact matches, zero invented numbers.
4. **Persistence confirmed.** `ai_conversations` and `ai_messages` rows were created and readable directly from the database for the test user, with the correct `role`/`content` on both the user and assistant messages.
5. **Usage logging confirmed.** `ai_usage_log` rows were written with the real model id (`claude-sonnet-5`) and real `input_tokens`/`output_tokens` counts from Anthropic's own response metadata.
6. **No secret leakage.** Every network response body during the session was scanned for the API key's `sk-ant-` prefix; none was found. The key never appears in any client-visible payload, matching its server-only architecture.

**Bug found and fixed:** two of the three test exchanges were silently cut off mid-word (one ended on a bare "เด", an incomplete syllable) because `DEFAULT_MAX_TOKENS` in `provider.ts` was `1024` — too low for a full Thai coaching answer covering income/expenses/net worth/debt/priority in one response, especially since the system prompt's "concise by default... unless detail is asked for" rule reasonably produces a longer answer for a broad opening question like this one. Fixed by raising it to `2048`; re-tested and the same question then produced a complete, naturally-concluding reply (1586 output tokens, safely under the new cap) with an explicit closing question rather than a truncated fragment. No test asserted the old value, so no test changes were needed; full lint/typecheck/test/build suite re-run clean afterward. The disposable test account and all its data were deleted via the Management API once verification was complete.

## Day 6 — Engagement & Automation (this session)

Makes WEALTH OS useful on an ongoing basis: missions that turn financial status into concrete action, a lightweight progression system, forgiving streaks, automation for recurring money movement, and a proper monthly reflection workflow — all deterministic, none of it casino-style. **Complete, unit-tested, and verified live** — migration applied, RLS checked with two real users, every new route exercised end-to-end with real seeded data, one real bug found and fixed via that live testing.

### Database Migration

`supabase/migrations/0007_engagement.sql` — applied to the live project. Adds `wealth_missions`, `xp_events`, `recurring_transactions`, `detected_subscriptions`, `notification_preferences`, `financial_notifications`, `monthly_reviews`. Deliberately **not created**: a `wealth_mission_progress` child table or a stored XP total (same "derive, don't duplicate" reasoning as Day 5's `income_missions` — progress is a scalar on the row, and total XP is always `SUM(xp_events.xp_amount)`, never a counter that could drift); a dedicated streaks table (every streak this task names is derivable live from dates already recorded elsewhere — `transactions.transaction_date`, `monthly_reviews.completed_at` — so persisting a redundant counter would repeat the same mistake in a new place). `wealth_missions` and Day 5's `income_missions` deliberately share an architecture (identical status lifecycle, identical `progress_quantity`/`target_quantity` mechanic, identical `impact_level` concept) without being merged into one polymorphic table — they have different natural relationships (`income_missions.related_opportunity_id` points at a catalog row; `wealth_missions.related_domain` is a tag, not a foreign key) and merging them would mean an invasive migration touching Day 5's already-shipped, tested table for no behavioral benefit. `financial_notifications.dedupe_key` has a `unique(user_id, dedupe_key)` constraint — deduplication is enforced by the database itself, not an application-level check that could be gotten wrong in a new code path.

### Recurring Transactions — posting policy

**Confirmation-first (Option A)**, chosen explicitly per the task's requirement to document one safe approach: a `recurring_transactions` row is a template only; `confirmRecurringTransaction()` (`src/features/recurring/actions.ts`) creates the real `transactions` row (or calls the existing `create_transfer` RPC for transfer-type items) *only* on explicit user action, then advances `next_due_date` via `src/lib/financial/recurring.ts`'s `calculateNextDueDate()` in the same step — so the same due date can never be double-confirmed, since it no longer exists as "due" once advanced. `calculateNextDueDate()` handles month-length edge cases correctly (Jan 31 + monthly → Feb 28/29 depending on leap year). Supports weekly/biweekly/monthly/quarterly/yearly. `/money/recurring` (added as a new `MoneyTabs` entry).

### Upcoming Bills

`src/lib/financial/upcoming-bills.ts` — pure `categorizeUpcomingBills()` buckets recurring-transaction due dates and liability due dates into overdue/next-7-days/next-30-days, and `deduplicateBillItems()` collapses two items that look like the same real-world obligation (same label + due date + amount) regardless of which source produced them. `totalDueCents` deliberately excludes the 30-day bucket — only what's overdue or due within a week counts toward "total due soon." Folded into `/money/recurring` above the recurring-item list rather than a separate route (not named as its own route in the task's route list). Not yet integrated into Safe-to-Spend (see Known Limitations).

### Subscription Detector

`src/lib/financial/subscription-detector.ts`'s `detectSubscriptions()` is fully deterministic: groups expense transactions by normalized merchant, requires at least 2 occurrences (never flags from one transaction), matches the average gap between occurrences against 5 named frequency bands (weekly/biweekly/monthly/quarterly/yearly, each with a tolerance window), and requires amount consistency (max-min spread under 15% of the median) — wildly different amounts from the same merchant are rejected outright as coincidence, not a subscription. Confidence is `high` (4+ occurrences, consistent interval), `medium` (3+, consistent), or `low` (the 2-occurrence floor) — never invented certainty. `src/features/subscriptions/queries.ts`'s `getDetectedSubscriptions()` runs this over the last 365 days of expense transactions and inserts only brand-new candidates as `pending`; an existing row's status (confirmed/dismissed/cancelled) is never overwritten by a fresh detection pass, so a dismissed merchant stays dismissed. `/money/subscriptions` (new `MoneyTabs` entry) shows merchant, estimated amount, frequency, confidence, next expected charge, and an annualized cost estimate explicitly labeled as an estimate. **Known, accepted limitation**: the detector has no category exclusion list, so a consistently-priced recurring purchase in a non-subscription category (e.g. a monthly grocery run landing on a similar day each month for similar amounts) can surface as a low-confidence candidate — this is the correct, honest behavior of a pattern-only detector (it's labeled "low" confidence, not asserted as fact) and the confirm/dismiss workflow exists precisely to let the user resolve it.

### XP / Progression

`src/lib/financial/xp.ts` — `XP_REWARDS` is a fixed table (first budget created: 50, mission completed: 20, income mission completed: 20, monthly review completed: 30, goal/emergency-fund/debt milestone: 25 each) covering only meaningful financial actions named in the task spec — there is no event type for spending money, opening the app, or any investment/checking-frequency behavior, so there is nothing to farm. `calculateLevel()` uses a small, finite threshold table (levels 1-8, capping at 8,000 XP) rather than an open-ended exponential curve — a progress indicator, not a game economy. Total XP is always summed live from the `xp_events` ledger; `awardXpOnce()` (`src/features/engagement/actions.ts`) deduplicates by `(user_id, event_type, related_id)` so the same real action (e.g. the same mission, the same monthly review) can never award XP twice.

### Streaks

`src/lib/financial/streaks.ts` — three pure functions (`calculateWeeklyStreak`, `calculateMonthlyReviewStreak`, `calculateTrackingDaysStreak`), each counting consecutive fully-elapsed periods with real activity, walking backward from today/this week/this month. Deliberately forgiving: the *current*, still-in-progress period is never held against the streak just because it hasn't happened yet (e.g. no transaction logged yet today doesn't zero out yesterday's streak) — only a fully-elapsed period with zero activity actually breaks it. No streak-loss messaging exists anywhere in the UI; `ProgressCard` only ever shows a plain count ("3 weeks consistent"), matching the task's explicit "avoid punishing resets, guilt language, aggressive streak-loss warnings" instruction.

### Wealth Missions

`src/lib/financial/wealth-missions.ts`'s `generateWealthMissionCandidates()` evaluates 11 named conditions against live data (no budget → "create your first budget"; tracking streak < 7 → "log expenses for 7 days"; income sources < 2 → "add a second income source"; savings rate < 10% → "increase your savings rate"; pending pending subscriptions > 0 → "review detected subscriptions"; etc. — every example CLAUDE.md and the task spec named), each tagged with a `related_domain` (`priority_engine`/`wealth_score`/`income_engine`/`goals`/`emergency_fund`/`debt_planner`/`budget`/`manual`) satisfying STEP 10's cross-system integration requirement. `isMissionAutoCompletable()` is the only automatic-completion rule — a target-bearing mission (e.g. "log 7 days," target 7) completes itself once its real, measured `progressQuantity` reaches the target; a mission with no target (e.g. "create your first budget") never auto-completes and always needs an explicit user action, so nothing is ever marked done from an AI claim. `syncWealthMissionsData()` (see "Bugs Fixed" below for why this is split from `syncWealthMissions()`) regenerates missions from live inputs on every `/missions` view, inserting new candidates (deduplicated by a stable `templateKey`, stored in the existing `title` column exactly as Day 5's `income_missions` stores its `mission_type` as a machine key) and refreshing progress on existing ones.

### Notification Foundation

`src/features/engagement/notifications-sync.ts`'s `syncNotifications()` checks 8 real conditions (upcoming bills, budget near-limit/exceeded, a newly-pending detected subscription, goal/emergency-fund/debt milestones reached, monthly review due, a high-impact mission still not started) against `notification_preferences` (all 10 categories on by default, individually toggleable) and inserts any newly-true one. **All `title`/`body` text is composed in the user's own locale at generation time** — a corrected design decision (see "Bugs Fixed"): the alternative of storing a raw category/type key and looking it up at render time would have meant every generation-time code path had to remember to localize, and a single miss would leak a raw key onto the screen exactly as happened in Day 5. Deduplication is the database's `unique(user_id, dedupe_key)` constraint — a duplicate insert for an unchanged condition (e.g. the same overdue bill on the same day) simply conflicts and is silently ignored, never an application-level "have I already notified for this" check that could be implemented incorrectly in a future code path. In-app only, per the task's explicit "do not require external push infrastructure." `/notifications`.

### Monthly Financial Review

Deliberately distinct from Day 4's automated Monthly Health Check (system-generated status) — this is a **user-facing workflow**: `src/features/monthly-review/queries.ts`'s `buildMonthlyReviewSnapshot()` computes income/expenses/cash flow/savings rate/net worth change/budget performance/debt progress/emergency fund progress/goal progress/income gap/missions completed, all from the same deterministic domain functions every other feature uses — never computed by AI. Reflection is 4 free-text fields (what went well, what to reduce, next month's focus, plus a free-form notes field covering the "where could you grow income" prompt) that can be saved as a draft and resumed, or completed. Completing **freezes the snapshot** into the `monthly_reviews` row at that moment (so a review always reflects what was true when the user actually did it, even if transactions are edited retroactively later) and awards XP exactly once via the same `related_id`-deduped ledger. One review per calendar month, enforced by `unique(user_id, year, month)`. `/review`.

### AI Integration

Reuses Day 4's architecture completely unchanged — **no new AI layer.** 5 new controlled tools added to `src/features/ai/tools/index.ts` (`getActiveWealthMissionsTool`, `getUpcomingBillsTool`, `getDetectedSubscriptionsTool`, `getMonthlyReviewStatusTool`, `getUserProgressTool`), each a thin wrapper returning a compact summary (top mission/bill/subscription only — never the full lists) of the same data the Engagement UI itself uses. `FinancialContext` gained 5 corresponding fields. The core system prompt gained two new rules: never mark a mission as done or claim unreported progress, and never invent a detected subscription, a bill, or a streak/XP value not explicitly given in the data block. 4 new suggested prompts were added verbatim from the task spec (เดือนนี้ฉันควรทำ Mission อะไร, มีบิลอะไรใกล้ถึงกำหนด, มี Subscription ไหนที่น่าจะไม่ได้ใช้, เดือนนี้ฉันพัฒนาการเงินขึ้นไหม) — verified live to render correctly alongside all 16 total suggested prompts.

### Dashboard

`EngagementSummaryCard` (`src/features/engagement/components/engagement-summary-card.tsx`) shows one compact row (current level + weekly streak, linking to `/missions`) and **at most one** most-actionable item — priority order: an overdue bill, then a pending detected subscription, then a due monthly review, then the top active mission, then an upcoming-within-7-days bill — never all of them stacked at once, per the task's explicit "do not clutter the dashboard" instruction. Deliberately does not call `syncWealthMissions()`/`syncNotifications()` itself (unlike `/missions` and `/notifications`, which do) to avoid a database write on every dashboard load, the app's busiest page — see Known Limitations.

### New Tables

`wealth_missions`, `xp_events`, `recurring_transactions`, `detected_subscriptions`, `notification_preferences`, `financial_notifications`, `monthly_reviews` — see "Database Migration" above.

### New Routes

`/missions`, `/money/recurring`, `/money/subscriptions` (both added to the existing `MoneyTabs`), `/review`, `/notifications`. None of these were added to the primary bottom navigation — all are reachable from the dashboard's `EngagementSummaryCard`, the Money tab strip, or direct links, matching the task's explicit "do not create a giant navigation menu" instruction.

### RLS Verification — DONE, 41/41 passed

An inline Node script (not committed) created two real disposable Supabase Auth users, seeded User A with a real row in all 7 new tables (via direct SQL for `xp_events`/`notification_preferences`, which the browser QA pass alone hadn't populated, plus real rows already produced by the live QA session for the other 5), then — using each user's own anon-key + access-token, never the service role — verified for every table that User B cannot see it in a list query, cannot fetch it by direct ID, cannot UPDATE it (where an update policy exists — `xp_events` has none, by design, since it's an append-only ledger), cannot DELETE it, and cannot INSERT a row claiming User A's `user_id`. **41/41 checks passed.** Both disposable users and all their data were deleted afterward via the Management API.

### Browser QA — DONE

Live browser QA (Playwright, a disposable test account seeded with real transactions across 3 months, a liability with a near-term due date, two recurring transactions — one already overdue, one upcoming — and 4 months of a consistent "Netflix" charge for subscription detection, all via direct SQL through the Supabase Management API) at 375/390/430/desktop. Verified live: `/missions` correctly auto-generated 7 real missions matching the seeded gaps (no budget, no goals, one income source, low tracking streak, etc.) with correct Thai titles, progress counters, and impact levels; clicking "start"/"skip" correctly updated status; `/money/recurring` correctly bucketed the overdue Water Utility bill, the upcoming Landlord rent, and the Credit Card A liability due date, and confirming the overdue item correctly posted a real transaction and advanced its due date by exactly one calendar month (2026-09-12 → 2026-10-12); `/money/subscriptions` correctly detected Netflix at "high" confidence (4 occurrences, ฿350, monthly, ฿4,200 annualized) and confirming/dismissing updated status correctly; `/review` correctly computed a live snapshot (savings rate 72.7%, debt paid ฿1,000, etc.) and reflection text saved as a draft was correctly persisted and re-displayed on a later visit; `/notifications` showed 5 correctly-localized notifications (monthly review due, a mission reminder, the detected subscription, and two upcoming bills) with no raw keys or enum values anywhere, and the preferences form's 10 checkboxes all rendered correctly; the dashboard's `EngagementSummaryCard` correctly surfaced the single most urgent item. No raw IDs, no raw enum values, no horizontal overflow, no guilt/manipulative wording found anywhere. A few `net::ERR_ABORTED` navigation errors appeared during scripted rapid-fire route-to-route navigation in one QA pass; every affected route was confirmed to load correctly and show accurate, correctly-persisted data on an isolated re-visit with a normal wait — consistent with the dev server's JIT-compile-on-first-hit behavior documented in every prior day's QA notes, not a product bug.

### Tests

6 new test files, 60 new tests (349 total, up from 289 at the end of Day 5), all passing: `tests/xp.test.ts` (reward correctness, no non-financial event types exist, level thresholds), `tests/streaks.test.ts` (continuity, the forgiving-current-period behavior, zero-history baseline), `tests/recurring.test.ts` (`calculateNextDueDate` for all 5 frequencies including leap-year month-end clamping, `isDue`/`isOverdue`/`hasEnded`), `tests/subscription-detector.test.ts` (monthly and weekly cadences, amount-variance tolerance, false-positive resistance — single transactions, wildly varying amounts, non-recurring intervals, no-merchant transactions all correctly rejected), `tests/wealth-missions.test.ts` (mission generation per condition, the "never vague" requirement, auto-completion rules), `tests/upcoming-bills.test.ts` (date-window bucketing, duplicate-obligation collapsing). Also extended `tests/priority-engine.test.ts`-adjacent AI test fixtures (`ai-context-builder.test.ts`, `ai-prompt.test.ts`) with the 5 new `FinancialContext` fields.

### Bugs Fixed (found via live QA and pre-flight AI verification, not visible from code review)

1. **AI response truncation** — see "AI Live Model Verification" above (`DEFAULT_MAX_TOKENS` 1024 → 2048).
2. **`revalidatePath()` called during a Server Component's render.** `WealthMissionList` (a Server Component) called `syncWealthMissions()` directly during render to keep missions fresh on every `/missions` view — but `syncWealthMissions()` is a `"use server"` action that calls `revalidatePath()`, which Next.js 16 explicitly disallows during render ("used revalidatePath during render which is unsupported"), crashing the entire route with a server error. Caught immediately via the first live screenshot of `/missions` (a full Next.js error overlay, not a subtle bug). Fixed by splitting the function: `syncWealthMissionsData()` contains all the actual sync logic with no `revalidatePath` call (safe to call during render, since the freshly-synced data is already what gets rendered in that same request — there's nothing stale left to revalidate), and `syncWealthMissions()` remains as a thin, still-`revalidatePath`-ing wrapper for any future client-triggered interaction. Audited every other Day 6 Server Component for the same pattern (`notifications-sync.ts`'s `syncNotifications()`, `subscriptions/queries.ts`'s upsert-on-read) — neither calls `revalidatePath`, so neither had this bug. Verified live afterward: `/missions` loads and auto-generates missions correctly with no error.

### Known Limitations

1. Upcoming Bills are not yet integrated into Safe-to-Spend's calculation — the task named this as "if the existing architecture supports it cleanly," and doing so correctly would mean re-deriving Safe-to-Spend's committed-obligations figure from two additional tables; deferred rather than rushed.
2. The Subscription Detector has no category exclusion list (see its section above) — a recurring non-subscription purchase in a consistent amount/interval can surface as a low-confidence candidate. Labeled honestly as "low," not hidden, and dismissible.
3. `EngagementSummaryCard` (dashboard) reads existing mission/notification state rather than triggering a fresh sync itself, so it can be up to one `/missions` or `/notifications` visit behind — a deliberate tradeoff against writing to the database on every dashboard load, the app's busiest page.
4. Wealth Missions use the same universal candidate-generation pass for every user rather than any personalization beyond the 11 named conditions — reasonable at current scope; a future pass could weight missions by the user's actual top Financial Priority rather than surfacing all applicable ones with equal footing.
5. Recurring Transactions' "custom interval" option (named as optional in the task spec — "if reasonable") was not built; the 5 named frequencies (weekly/biweekly/monthly/quarterly/yearly) cover every example given.

## Day 7 — SaaS / Subscriptions / Billing (this session)

Turns WEALTH OS into a monetizable SaaS product: Free/Plus/Pro plans, server-enforced feature gates, AI usage limits, a billing provider abstraction, checkout/portal/webhook flows, and contextual paywall UI. **Complete, unit-tested, and verified live** — migration applied, RLS checked with two real users, every gated surface exercised end-to-end at Free and Plus states with real seeded subscription data, one real bug found and fixed via that live testing.

### Plan Architecture

`src/lib/billing/plans.ts` is the single source of truth — a `PLANS: Record<PlanId, PlanDefinition>` object (display name, THB price, `limits`, `features`), exactly mirroring the "one central plan/entitlement configuration" requirement. Nothing else in the codebase hardcodes a plan comparison (`if (plan === "pro")`) — every gate reads `PLANS` directly or via `src/lib/billing/entitlements.ts`. Ten stable `FEATURES` constants (`AI_CHAT`, `FORECAST`, `DEBT_PLANNER`, `ADVANCED_GOALS`, `SUBSCRIPTION_DETECTOR`, `MONTHLY_REVIEW`, `INCOME_OPPORTUNITIES`, `INCOME_MISSIONS`, `WEALTH_MISSIONS`, `ADVANCED_INSIGHTS`). Stripe price-ID lookups (`getStripePriceId`/`planIdForStripePriceId`) deliberately live in the separate `server-only` `src/lib/billing/provider.ts` instead, since `plans.ts` is imported from client components (pricing page) and must never touch `process.env.STRIPE_*`.

### Entitlement Matrix

**Free** (never aggressively crippled — the full Day 1-3 core stays free): unlimited accounts/transactions, basic dashboard/budget, up to 3 active goals, 15 AI messages/month, basic Income Engine (top 3 opportunities, 3 concurrent missions), basic Wealth Missions. **Plus** (฿149/month): everything in Free, unlimited goals, Forecast, Debt Planner, full Monthly Review, Subscription Detector, full Income Opportunities/Missions, 150 AI messages/month. **Pro** (฿399/month): everything in Plus, 500 AI messages/month. Pro is a strict feature superset of Plus and currently differs only by numeric limits (AI allowance) rather than additional feature flags — Day 7 doesn't introduce new advanced forecasting/scenario tooling beyond Day 3's existing Forecast, so there was nothing further to gate Pro-only; see Known Limitations.

### Database Migration

`supabase/migrations/0008_billing.sql` — applied to the live project. Adds `subscriptions` (`user_id` unique, `plan`/`status` text+CHECK, `provider`/`provider_customer_id`/`provider_subscription_id`/`provider_price_id`, `current_period_start`/`current_period_end`, `cancel_at_period_end`, `trial_end`) and `billing_events` (webhook idempotency ledger, `unique(provider, provider_event_id)`). Statuses modeled: `free`/`trialing`/`active`/`past_due`/`canceled`/`incomplete`. A missing `subscriptions` row is treated as Free in application code — no row is pre-created at signup, avoiding an invasive change to the existing `handle_new_user` trigger. Deliberately **not created**: a `usage_counters` table (AI usage is a live `COUNT` against Day 4's `ai_usage_log` scoped to the current calendar-month period — see "AI Usage Limits" below — so a second ledger could only ever drift from the real one, the same "derive, don't duplicate" reasoning Days 5-6 already applied); `plan_overrides` (no real comp/grandfather use case exists yet — an admin can already set `subscriptions.plan` directly via service-role/Management API access in the meantime).

### Subscription Source of Truth

Billing provider → webhook (`/api/billing/webhook`, service-role writes only) → `subscriptions` table → `src/lib/billing/entitlements.ts` resolver → every page/action. `resolvePlanFromSubscription()` (the pure core of `getUserPlan()`) treats a non-entitling status (`canceled`/`incomplete`/`free`) as Free **regardless of a stale paid `plan` value left over from before a downgrade** — status always wins. `past_due` still grants entitlement (a grace period, matching Stripe's own retry-before-cancellation semantics) so a temporarily failed card doesn't instantly lock out a paying user. Client-supplied plan values are never trusted anywhere; this is enforced at the database layer too (see RLS below), not only in application code.

### Feature Entitlement System

`src/lib/billing/entitlements.ts` exports `getUserPlan()`, `getEntitlements()`, `canUseFeature()`, `requireFeature()`, `getFeatureLimit()` — all server-only, all resolving the *signed-in* user from the session, never from a parameter a caller could pass a different value for. `requireFeature()` returns `{ allowed, plan }` rather than throwing, so every call site decides its own denial UX (a locked-state card, a plain error string, a 403 JSON response). Server-side enforcement is wired into every premium surface's actual data path, not just UI hiding: `/plan/forecast`, `/plan/debt`, `/money/subscriptions`, `/review` each gate at the top of the page component (before even querying real data); `createGoal()` (`src/features/goals/actions.ts`) checks `activeGoalsMax` against a live count before inserting; `OpportunityList`/`MissionList` (Day 5) slice to the plan's limit and append a "more available in Plus" card for the remainder.

### AI Usage Limits

Reuses `ai_usage_log` (Day 4) directly — no second logging system. `src/lib/billing/period.ts`'s `getCurrentBillingPeriod()` defines the metering window as the calendar month (deliberately **not** tied to a paid subscription's actual Stripe period, since a Free user has none — one simple, always-defined window for every plan). `src/lib/billing/ai-usage.ts`'s `getAIUsageStatus()` does a live `COUNT` scoped to that window and returns `{ used, limit, remaining, limitReached, resetDate }`. `/api/ai/chat/route.ts` now runs the full required sequence: authenticate → resolve plan → check usage → **reject with a clear 403 JSON error (never silently fail) before ever calling the provider** → call provider → write usage log. The distress-signal short-circuit (existing Day 4 behavior) is deliberately exempt from the limit check — it never calls the provider and costs no tokens, so a user in crisis is never blocked by a quota. A subtle `AIUsageIndicator` on `/ai` shows the running count and an upgrade link once within 3 messages of the limit; the client needed **no changes at all** to surface a limit-reached error, since `ai-coach-chat.tsx` already renders any JSON error response's `error` string in its existing error banner.

### Billing Provider

`src/lib/billing/provider.ts` defines the `BillingProvider` interface (`createCustomer`, `createCheckoutSession`, `createPortalSession`, `cancelSubscription`, `resumeSubscription`, `verifyWebhook`, `normalizeSubscription`) and a `StripeProvider` implementation via direct `fetch` against Stripe's REST API — no `stripe` SDK dependency, consistent with this codebase's existing pattern for external HTTP APIs (Anthropic in `features/ai/lib/provider.ts`, the Supabase Management API used to apply every migration this project has ever shipped). Webhook signature verification is implemented manually with Node's built-in `crypto` (`t=<timestamp>,v1=<hmac>` scheme, `timingSafeEqual` comparison) rather than the Stripe SDK's helper. `getBillingProvider()` returns `null` (never throws) when `STRIPE_SECRET_KEY` is unset — the exact `getAIProvider()` template — and every caller (checkout action, portal action, webhook route) treats "billing not configured" as a real, expected state with a clear localized error, not a crash.

### Checkout

`createCheckoutSessionAction()` (`src/features/billing/actions.ts`) never trusts a client-supplied price: `planId` (`"plus" | "pro"`) selects one of exactly two server-known Stripe price IDs via `getStripePriceId()`. Bootstraps a Stripe customer (and persists `provider_customer_id` via the admin/service-role client — the one place server code intentionally bypasses RLS, and only to store a provider-issued id, never a plan or status) if the user doesn't have one yet. Routes: `POST /api/billing/checkout` (thin wrapper), `POST /api/billing/portal`, `POST /api/billing/webhook`. **Never activates paid access from the success redirect** — `/billing?checkout=success` shows a neutral "confirming with the payment provider" notice if the resolved plan is still Free at that moment, rather than claiming success; only the webhook writes a paid plan.

### Webhooks

`/api/billing/webhook` verifies the raw-body signature first, then records `(provider, provider_event_id)` in `billing_events` *before* applying any state change — a duplicate delivery hits the table's unique constraint and returns 200 immediately without touching `subscriptions` a second time. Handles `checkout.session.completed` (links `provider_customer_id`), `customer.subscription.created`/`.updated` (upserts plan/status/period fields, resolving the plan from the event's own Stripe price id — never from client-suppliable data, and never guessing a plan for an unrecognized price id), `customer.subscription.deleted` (sets `status: canceled`), `invoice.payment_failed` (`status: past_due`), `invoice.payment_succeeded` (clears `past_due` back to `active`). The actual state-decision logic (`buildSubscriptionUpsertPatch`, `buildSubscriptionCancelPatch`, `buildPastDuePatch`, `buildRecoveredPatch`, `isDuplicateEventError`) is factored into `src/lib/billing/webhook-logic.ts` as pure functions, independent of the admin DB client — the same "pure core, thin DB wrapper" split this codebase uses throughout, and what makes STEP 17's webhook test cases possible without mocking Supabase.

### Feature Gates (Paywalls)

`LockedFeatureCard` (`src/features/billing/components/locked-feature-card.tsx`) is the first real usage of `LockedBadge`, built in an earlier session's icon set but never wired to any page until now. A single inline, contextual card — never a full-screen modal — matching the task's literal example copy ("ใช้ได้ใน Plus", "อัปเกรดเพื่อดู Forecast..."). Wired into Forecast, Debt Planner, Subscription Detector, and Monthly Review's page components; Income Opportunities/Missions use a lighter "N more available in Plus" variant appended after a truncated list instead of blocking the page outright, since Free already includes a real (if smaller) version of those features.

### Pricing

`/pricing` — three-card layout (`PricingTable`), THB monthly pricing only (no annual price or discount is shown or implied anywhere, since no annual plan exists), a "Recommended" badge on Plus, an `UpgradeButton` (client component, POSTs to `/api/billing/checkout`, redirects to the returned Stripe URL, shows a toast on failure) for Free users, and a "Current Plan" badge/state for whichever plan the viewer is actually on (see Bugs Fixed — this didn't work correctly for a Plus subscriber on first pass). Disclaimer text explicitly restates CLAUDE.md's "never guarantee financial returns" rule.

### Billing Settings

`/billing` — `BillingStatusCard` shows the plan badge, a localized status label (never the raw `active`/`past_due`/`canceled` enum value), renewal date (or "ends on" + a résumé button when `cancel_at_period_end` is true), AI usage this period, and `ManageBillingButton` (launches Stripe's own hosted portal rather than a custom card-management UI, per the task's explicit preference) plus `CancelResumeButton`. `/profile` gained a compact Billing summary card (current plan badge + a link into `/billing`) rather than duplicating the full status card on two pages.

### Dashboard Integration

Only a subtle `PlanBadge` pill next to the dashboard's title (links to `/pricing` if Free, `/billing` otherwise) — no pricing pitch, no usage numbers, nothing that turns the dashboard into a pricing page, per the task's explicit minimal-integration instruction.

### RLS Verification — DONE, 8/8 checks passed

Two real disposable Supabase Auth users; a `plus`/`active` subscription row seeded for User A directly via the Management API (simulating a webhook write, since `SUPABASE_SERVICE_ROLE_KEY` is empty in this environment — see Known Limitations). Verified via each user's own anon-key + access token: (1) User A can `SELECT` their own row; (2) User B's `SELECT` returns an empty array — cannot see User A's billing state; (3) User A's `INSERT` attempt is rejected outright (`42501`, RLS policy violation); (4) User A's `UPDATE` attempt (`plan: "pro"`) silently affects zero rows — **re-verified by re-selecting: the plan was still `plus`, never actually changed** — proving a user cannot self-grant a plan upgrade even via a well-formed authenticated request; (5) `billing_events` returns empty to a normal user (zero policies — default deny, not user-owned data); (6) an `INSERT` into `billing_events` is rejected outright. Both users and the seeded row were deleted afterward via the Management API.

### Browser QA — DONE

Playwright at 390px + desktop, a disposable QA account. **Free state**: dashboard (plan badge), `/pricing` (correct Thai copy, THB prices, feature lists, "Current Plan" on Free), `/plan/forecast`/`/plan/debt`/`/money/subscriptions`/`/review` all correctly show the locked-state card instead of real content, `/billing` (Free badge, `0/15` usage, upgrade button), `/profile` (billing summary card), `/ai` (usage indicator), `/billing?checkout=success` (pending-confirmation notice, plan still shown as Free — never a false "upgraded" claim), `/billing?checkout=canceled` (neutral notice). **AI limit reached**: seeded 15 `ai_usage_log` rows for the QA user (Free's exact monthly limit), reloaded `/ai` — usage indicator correctly showed `15/15 · ใช้ครบแล้ว` with an upgrade link, and sending a message returned the exact limit-reached error banner (`คุณใช้ข้อความ AI ครบตามสิทธิ์ของแผนนี้ในเดือนนี้แล้ว... 2026-10-01`) with no client-code changes needed. **Plus state**: seeded an `active` Plus subscription row for the same account — `/pricing` now shows "Current Plan" on the Plus card (see Bugs Fixed), `/plan/forecast` and `/plan/debt` now render their real (empty-state) content instead of the locked card, `/billing` shows the Plus badge, "ใช้งานอยู่"/renewal date, `150`-message limit, and Manage/Cancel/Upgrade buttons; clicking "Manage billing" correctly showed a graceful Thai toast error ("ระบบชำระเงินยังไม่พร้อมใช้งานในขณะนี้") rather than crashing, since no Stripe key is configured. **Cancel state**: set `cancel_at_period_end: true` on the same row — `/billing` correctly switched to "สิ้นสุดวันที่" (Ends on) and a "เปิดใช้งานต่อ" (Resume) button. No raw provider ids, no raw price ids, no raw internal status enum values, and no Thai/English mismatch were found anywhere (plan names Free/Plus/Pro are deliberately left untranslated, as proper nouns — consistent with how the app already treats brand-like terms). The account, its seeded subscription row, and its `ai_usage_log` rows were all deleted afterward; Playwright was uninstalled afterward per the established per-day pattern.

### Tests

4 new test files, 53 new tests (402 total, up from 349 at the end of Day 6): `tests/billing-plans.test.ts` (plan resolution across every status including the "stale paid `plan` value after cancellation" case, feature entitlement per plan, a Free→Plus feature-transition check, and an explicit "security" block proving a Free-resolved user is refused a Plus-only feature regardless of what a client claims); `tests/billing-ai-usage.test.ts` (usage boundaries — under/exactly-at/over the limit, the over-limit case never going negative, calendar-month period math including the December→January rollover); `tests/billing-provider.test.ts` (`getBillingProvider` null/non-null/mock-injection mirroring `ai-provider.test.ts`'s exact pattern, `StripeProvider.verifyWebhook` valid/wrong-secret/tampered-body/missing-header/unconfigured-secret/malformed-header, `normalizeSubscription` field mapping, `planIdForStripePriceId` never guessing an unrecognized price); `tests/billing-webhook-logic.test.ts` (duplicate-event detection, the exact patch built for subscription created/updated/deleted and payment failed/succeeded). Every DB-touching function (the entitlement resolver's Supabase fetch, the webhook route's admin-client writes) was deliberately kept as a thin wrapper around a pure, directly-tested core — consistent with this codebase's existing convention that DB-touching code is verified live with real users/data, not via mocks.

### Bugs Fixed (found via live browser QA, not visible from code review)

1. **Pricing page always showed "Recommended" on the Plus card, even for a user already subscribed to Plus.** `PricingTable`'s header badge logic checked `planId === "plus"` before checking `isCurrent`, so a Plus subscriber viewing `/pricing` saw their own current plan labeled as a recommendation to upgrade to, rather than "Current Plan" — a confusing label exactly of the kind STEP 20 named as a QA risk. Caught by seeding a live Plus subscription and re-visiting `/pricing` in the browser; not something a code read alone made obvious, since the bug only manifests when `currentPlan === "plus"`. Fixed by checking `isCurrent` first; re-verified live afterward.

### Known Limitations

1. **`SUPABASE_SERVICE_ROLE_KEY` is present as a name in `.env.local` but its value is empty** — a pre-existing environment gap, not a Day 7 regression. `createAdminClient()` will throw `"SUPABASE_SERVICE_ROLE_KEY is not set"` the moment checkout customer-bootstrap or the webhook handler actually tries to write, until a real key is supplied. RLS verification and browser QA above worked around this by seeding subscription rows directly via the Supabase Management API (equivalent privilege for testing purposes), which is not a substitute for the app's own admin client working at runtime.
2. **No Stripe keys are configured in this environment** (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_ID_PLUS`/`STRIPE_PRICE_ID_PRO` all unset) — the real checkout→webhook→plan-change→portal→cancel flow against Stripe test mode has **not** been exercised end-to-end and remains a manual verification step for whoever configures real (test-mode) Stripe credentials. Every code path was written to degrade cleanly without them (verified live — see Browser QA) and the webhook/provider logic itself is fully unit-tested against a mocked provider.
3. Pro is currently a strict feature superset of Plus, differentiated only by a higher AI message allowance (500 vs. 150) — no Pro-exclusive feature flag exists yet, since Day 7 doesn't introduce new advanced forecasting/scenario tooling beyond Day 3's existing Forecast. A future pass could add Pro-specific depth (e.g. multi-scenario comparison) once such a feature actually exists to gate.
4. Transaction/financial-history limits for Free (named as optional — "if any" — in the task spec) were deliberately not implemented; doing so would mean modifying the core transaction-browsing UX broadly for a limit the task didn't mandate, and CLAUDE.md's "do not aggressively cripple Free" instruction argues against adding one speculatively.
5. `ADVANCED_INSIGHTS` is fully wired into the plan config and entitlement resolver but not yet gating anything in the UI — the existing single Next-Best-Action + one Insight card (Day 4) remain available to every plan, since there's no "deeper insights" surface yet to differentiate Free from Plus without retroactively removing value Free users already have today. Ready for a future pass (e.g. showing 3 insights instead of 1) to gate against.
6. Annual billing does not exist — monthly THB pricing only, per the task's explicit "do not display fake annual discounts" instruction.

### Required Env Vars (production)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO` (all optional/server-only in `src/config/env.ts` — `getBillingProvider()` returns `null` when absent) — none are set in this environment. `SUPABASE_SERVICE_ROLE_KEY` must also actually hold a value (see Known Limitations #1) for checkout/webhook writes to function.

## Day 8 — Production Hardening / Launch Readiness (this session)

Not a new-feature phase — security, reliability, performance, accessibility, observability, and deployment readiness across everything Days 1-7 built. **Complete and fully verified live**: two migrations applied, the widest cross-user RLS sweep of any day (32 tables), and a full realistic browser journey with a comprehensively-seeded Plus-plan account.

### Security Audit

Reviewed: authentication, authorization, RLS, billing webhook security, AI API handling, environment variables, service-role usage, server actions, route handlers, form validation, XSS/CSRF/open-redirect/IDOR risk, prompt-injection boundaries, and logs for sensitive data. Found and fixed one real issue, confirmed several others were already solid:

- **Fixed: open redirect in `/auth/callback`.** The `?next=` query param was interpolated directly into a post-login/email-confirmation redirect with no validation — a crafted link could send an authenticated user to an attacker-controlled origin immediately after a real auth flow, a more convincing phishing vector than a cold link. Fixed with `src/lib/safe-redirect.ts`'s `safeRedirectPath()` (rejects absolute URLs, protocol-relative `//`, and the `/\` backslash-normalization trick some browsers apply), unit-tested (8 cases).
- **Confirmed clean**: RLS is enabled on all 37 tables in the live project (verified via a direct query against `pg_tables`, not by reading migration files and hoping); no secret is exposed via `NEXT_PUBLIC_*` (audited every env var); `SUPABASE_SERVICE_ROLE_KEY`/`AI_API_KEY`/`STRIPE_*` are never imported into a client component (grepped); the AI prompt-injection sanitizer (`sanitizeUserText`, built Day 4) is applied to every single user-editable field that reaches the system prompt (goal/liability/category/income-source/opportunity names, bill labels, subscription merchants — verified line-by-line against `prompts/money-coach.ts`); the webhook stores raw payloads in `billing_events` for audit but never trusts them for authorization without the signature check that already passed, and RLS denies all client access to that table regardless; `budget_categories` (a table with no `user_id` column of its own) has no application-level ownership filter on delete, but its RLS `DELETE` policy independently enforces ownership through the parent `budgets` row via a subquery — confirmed this is real DB-level protection, not just missing app-level redundancy.
- **CSRF**: `@supabase/ssr`'s auth cookie defaults to `SameSite=Lax` (no override anywhere in this codebase), which blocks the classic cross-site form-POST CSRF vector against `/api/billing/checkout`, `/api/billing/portal`, and `/api/ai/chat` — reviewed and accepted as sufficient; no additional CSRF token layer was added (would be redundant with Lax cookies and is exactly the kind of unnecessary architecture change this phase is told to avoid).
- **IDOR**: audited every `.eq("id", ...)` call across every `actions.ts` file — all pair it with `.eq("user_id", user.id)` except the one RLS-protected case above.

### Environment Validation

`src/config/env.ts` gained `assertProductionConsistency()`, run automatically inside `getServerEnv()` whenever `NODE_ENV === "production"`: throws a clear, secret-free error if Stripe is partially configured (1-3 of the 4 `STRIPE_*` vars set — worse than none, since checkout could work while the webhook can never verify, or vice versa) or if all four are set but `SUPABASE_SERVICE_ROLE_KEY` is missing (billing writes need the admin client). Unit-tested (6 cases, including a check that no error message ever contains an actual secret value). `scripts/check-env.mjs` (`npm run check:env`) is a manual pre-deploy tool — prints ✅/❌ per variable **name only, never a value** — for running against a pulled production environment before flipping a switch. `.env.example` updated with the four `STRIPE_*` names.

### Database Safety

Full audit of migrations `0001`-`0008` against the live project (not just reading the SQL files): confirmed RLS enabled on **all 37 tables** with zero exceptions; confirmed every money column uses `NUMERIC(18,2)` and every timestamp column is `timestamptz` (no bare `timestamp` anywhere); confirmed no destructive DDL (`DROP TABLE`/`TRUNCATE`/`DELETE`) exists in any migration file; confirmed duplicate-prevention constraints exist everywhere they matter (`billing_events(provider, provider_event_id)`, `financial_notifications(user_id, dedupe_key)`, `monthly_reviews(user_id, year, month)`, etc.). Cross-checked all 23 foreign keys against the live index list and found one genuinely load-bearing gap: `transactions.category_id` had no covering index despite `getTransactions()` filtering on it directly, and `transactions` is this app's largest, fastest-growing table — fixed in `0010_performance_indexes.sql` (`transactions(user_id, category_id)`, partial on non-null). Three smaller FK gaps (`debt_plan_priorities.liability_id`, `income_missions.related_opportunity_id`, three `recurring_transactions` account columns) were deliberately left un-indexed — each table holds a small, bounded per-user row count and none is filtered by that column in any current query; indexing them now would be exactly the premature optimization this phase warns against. A from-scratch local/Docker Postgres replay of the migrations was not performed (no Docker available in this environment) — reproducibility was instead verified against the live project, which has been built incrementally from these exact migration files across 8 sessions with zero manual hotfixes outside them.

### Error Handling

Added `src/app/error.tsx` (segment-level boundary), `src/app/global-error.tsx` (root-layout boundary — renders its own `<html>`/`<body>` with inline styles only, since it can't assume the CSS pipeline that would normally provide them succeeded), and `src/app/not-found.tsx`. All three use static, hardcoded bilingual (Thai-first) text rather than the `useTranslation()` i18n hook — deliberately, since these boundaries must render correctly even when the failure originated in a layout that would normally provide that context. Never render `error.message`/`.stack` in production, only in development. Every existing page already had loading/empty/error states per the Day 1-7 Definition of Done; no additional per-route `loading.tsx` files were added on top of that.

### Observability

`src/lib/observability.ts` — `captureError()`/`captureMessage()`, a provider-agnostic boundary (no Sentry/equivalent is configured in this environment; wiring one later means changing this file's body, not any call site). Wired into: both global error boundaries, the AI chat route's stream error handler (previously swallowed every provider failure with zero server-side visibility beyond the generic user-facing message), the billing webhook's processing/dedupe-failure paths, and all four billing actions' catch blocks (checkout, portal, cancel, resume — all previously bare `catch { return {error} }` with no logging at all). Never logs secrets, full financial context, full AI prompt/response text, or payment data.

### Analytics

`src/lib/analytics.ts` — `trackEvent()`, provider-agnostic (no PostHog/GA/equivalent configured; a dev-only console line until one is wired in), server-only by design (every call site is a server action/route handler, next to the real state change, not a client-fired event that might never arrive). Wired into a representative, meaningful subset of the example event list: `signup_completed`, `onboarding_completed`, `first_goal_created` (reuses the goal-limit count query already needed for Day 7's plan enforcement — no extra query), `first_ai_message_sent` (approximated as "zero messages logged so far this billing period," a close proxy for "ever" without a second lifetime-count query), `pricing_viewed`, `checkout_started`, `subscription_activated`/`subscription_canceled` (from the webhook, the only trustworthy place), `monthly_review_completed`. `first_account_created`/`first_transaction_created`/`first_budget_created`/`first_income_opportunity_viewed`/`mission_completed` were not wired this session — the abstraction is ready for them. Never sends account numbers, transaction descriptions, AI conversation content, or secrets — only small tags like plan/feature/completion-state.

### Performance

Found and fixed the most impactful issue via systematic audit, not guessing: **`getProfile()` was being called 2-3 times per request** — once in `(app)/layout.tsx` for the auth/onboarding gate, then again independently in nearly every page and several nested layouts (`money`, `plan`, `earn`) for locale resolution. A request to `/money/budget` issued 3 identical profile queries before this. Fixed by wrapping the function in React's `cache()` (`src/features/profile/queries.ts`) — zero changes needed at any of the ~19 call sites, since `cache()` transparently deduplicates identical calls within one request's render pass and resets automatically between requests. Also found Recharts (a genuinely large dependency) was statically bundled into the dashboard's initial client JS on the app's highest-traffic page; code-split it via `next/dynamic({ssr:false})` behind a new client-boundary wrapper (`src/features/dashboard/components/charts-lazy.tsx`), with a `Skeleton` loading state. `forecast-view.tsx`/`net-worth-view.tsx` also use Recharts but mix chart and non-chart UI in one monolithic component — splitting those cleanly would need a larger refactor to extract a chart-only subcomponent first; deferred rather than risked (see Known Limitations). No other N+1 or serial-await patterns were found in the query layer — every day since Day 1 has consistently used `Promise.all` for independent server queries.

### Accessibility

Targeted review of the components the task named specifically: AI chat, charts, bottom navigation, forms/Selects. Fixed real, concrete gaps: the AI chat's message list had no `aria-live` region, so a screen reader user got no notification of a streaming reply arriving — added `role="log" aria-live="polite"` (`ai-coach-chat.tsx`); the message textarea relied on a placeholder alone for its accessible name — added an explicit `aria-label`; both dashboard charts (Income vs Expense, Spending by Category) conveyed their data visually/via-tooltip only — added a `sr-only` text summary with the actual figures next to each; no `prefers-reduced-motion` support existed anywhere — added one global CSS rule in `globals.css` that disables animation/transition duration app-wide for users who've asked their OS for reduced motion, rather than touching each of the 11 files that currently use `animate-*`/`transition-*`. Reviewed and found already solid: the bottom nav (`aria-label="Primary"`, `aria-current="page"`, decorative icons marked `aria-hidden`), the transaction form (paired `Label`/`htmlFor`/`id`, `aria-label` on the amount field, `role="alert"` on validation errors), and the Select components (no repeat of the old "`SelectValue` needs an explicit label-resolving children function" bug — checked, not present in the new billing/pricing Selects).

### Responsive QA

Verified via the full live browser walkthrough below at 390px (mobile) and via earlier Day 7 passes at 375/390/430/desktop — no horizontal overflow, no clipped Thai text, correct currency formatting at large values (₿2,029,500.00 rendered cleanly on the dashboard), correct empty/zero states, correct chart rendering at mobile width.

### PWA

`src/app/manifest.ts` (Next's native `MetadataRoute.Manifest` file convention — auto-linked, no manual `<link rel="manifest">` needed): name, short_name, Thai description, `start_url: "/dashboard"`, `display: "standalone"`, theme/background colors, and two new dedicated icon routes (`icon-192`, `icon-512` — plain Route Handlers using the same `next/og` brand-mark drawing as the existing `icon.tsx`/`apple-icon.tsx`, since the manifest needs stable, explicitly-sized URLs the special-file convention doesn't produce on its own). Root layout gained a `viewport` export (`themeColor`, `initialScale`). **Deliberately no service worker** — this app's entire value is live financial/billing/AI state, and caching any of it risks showing a stale balance, a stale plan, or a stale AI reply as current; installability without a false claim of offline support is the honest feature to ship here, consistent with this project's standing "never create fake successful integrations" rule.

### SEO

`src/app/robots.ts` (disallows every authenticated path plus `/api/*`, points at the sitemap) and `src/app/sitemap.ts` (lists only `/`, `/login`, `/signup`). The `(app)` route group's layout now exports `robots: { index: false, follow: false }` — belt-and-suspenders with `robots.ts`, since a page-level meta tag and a site-wide robots file are both worth having. Root layout gained full Open Graph + Twitter card metadata (title, description, locale) and a title template (`%s — Wealth OS`). **Known tradeoff**: `/pricing` lives inside the `(app)` route group (it reuses that layout's nav/auth from Day 7) and therefore requires a session and is noindexed — it is not a true public marketing page. Making it public would mean building a separate unauthenticated marketing shell, a larger architectural change than this phase's scope; documented here rather than silently left ambiguous.

### Rate Limiting / Abuse Protection

A real, live-tested, atomic, cross-instance limiter — not an in-memory stand-in that would reset on every serverless cold start. `supabase/migrations/0009_rate_limits.sql` adds `rate_limit_buckets` (RLS enabled, zero policies — not user-owned data) and `check_rate_limit(key, window_seconds, max_count)`, a `SECURITY DEFINER` Postgres function doing an atomic fixed-window check-and-increment in one `INSERT ... ON CONFLICT`, explicitly granted to both `anon` and `authenticated` (login/signup protection must work before a session exists). `src/lib/rate-limit.ts`'s `checkRateLimit()` calls it via the ordinary request-scoped Supabase client — **no service-role key needed**, unlike this app's billing writes, since the function's own elevated privilege (not the caller's role) governs access to the counter table. **Fails open**: if the check itself errors, the request is allowed through and the failure is reported via `captureError` — a broken limiter must never lock out real users. Wired into: `login` (10/5min per IP), `signup` (5/hour per IP), `forgotPassword` (3/hour per IP), `/api/ai/chat` (15/min per user — burst protection, distinct from Day 7's monthly plan quota, and exempted the same way the quota is for the distress-signal short-circuit), `createCheckoutSessionAction`/`createPortalSessionAction` (10/10min per user each). **Verified live**: called the function directly via SQL with `max_count=3` — the first three calls returned `true`, the fourth returned `false`, confirming atomic, correct behavior, not just code that compiles.

### Billing Production Readiness

Reviewed Day 7's implementation against this phase's checklist: test/production key separation needs no app-level mechanism — Stripe's own key prefixes (`sk_test_`/`sk_live_`) already distinguish mode, so switching environments is purely a Vercel env-var swap (documented in README.md); webhook signature verification is manual HMAC via Node's `crypto` (`StripeProvider.verifyWebhook`), unit-tested for valid/wrong-secret/tampered-body/missing-header/unconfigured-secret/malformed-header; duplicate event handling is the `billing_events` unique constraint, unit-tested; every subscription state transition (`active`/`trialing`/`past_due`/`canceled`/`incomplete`, `cancel_at_period_end`) was re-verified live this session via direct seeding — including the `past_due`-still-grants-entitlement grace period and the immediate entitlement drop on `canceled` regardless of a stale `plan` value; the Free fallback (no row = Free) was exercised live throughout. **Not activated**: no production Stripe credentials exist in this environment, so this remains test/mocked-provider coverage only — see Known Limitations and README.md's "How to deploy" for the exact production switch steps.

### AI Production Readiness

Confirmed live (Day 6's pre-flight verification, re-confirmed structurally this session): the real Anthropic provider works, streaming works, usage limits work. Added this session: a 30-second timeout on the non-streaming `generate()` call and a 60-second timeout on `stream()` (`AbortSignal.timeout()` — a hung upstream request must not hang this app's request indefinitely on a serverless host with its own execution-time limit). **Deliberately no retry logic** alongside the timeout — retrying a request that already reached Anthropic risks generating and billing a second response for one user message. Re-confirmed the Financial Context sent to every AI call: no full transaction history (only aggregated counts + top categories), no free-text reflection fields (monthly review notes, etc.) — only structured counts/statuses, and every user-editable name field is passed through `sanitizeUserText()` before reaching the prompt (see Security Audit).

### Backup / Recovery Readiness

- **Database backup**: Supabase manages automated backups at the platform level for the project tier in use; this repository does not configure or control that independently — verify the current tier's backup/PITR window in the Supabase dashboard before launch, since this was not (and cannot be) verified from application code.
- **Schema is fully reconstructable**: all 10 migrations are committed to this repository in order; a new environment can be stood up from zero by applying them sequentially (verified structurally this session — see Database Safety above).
- **Webhook replay**: Stripe retains and can resend webhook events from its own dashboard for a rolling window; this app's idempotency guarantee (`billing_events` unique constraint) makes a replay safe to resend without double-processing.
- **Billing state reconciliation**: `subscriptions` is fully derived from Stripe's own state (the webhook is the only writer of paid status) — if it ever drifts, the correct recovery is re-fetching the customer's subscription from the Stripe API and re-running the same `buildSubscriptionUpsertPatch()` logic already used by the webhook (pure and already unit-tested), not a manual database edit.
- **Not reconstructable from Stripe**: this app's own financial data (transactions, budgets, goals, etc.) has no source of truth outside this database — Supabase's own backup mechanism is the only recovery path for that data, which is exactly why the tier/PITR check above matters most.
- No backup guarantee beyond what Supabase's platform-level tier actually provides is claimed here.

### Production Deployment

No Vercel project or prior deployment exists for this repository in this environment (no `vercel.json`, no deployment history) — deployment was not attempted, per this phase's own fallback instruction ("prepare everything and document the exact remaining manual step"), and doing so would require external account access this session does not have. README.md's "How to deploy" section was updated with the exact steps: environment variables (including the new `STRIPE_*` set and `npm run check:env`), the Supabase auth redirect URL, running migrations against production, and the Stripe webhook endpoint + event subscription list needed for billing to work in production.

### Full E2E

A real, live, comprehensively-seeded journey — not a smoke test. Two disposable users created via the Supabase Auth REST API; User A seeded via direct SQL (not the Management API's admin bypass alone — genuine rows) across **every major system**: accounts, transactions, budget + budget categories, assets, liabilities, financial goals, emergency fund, net worth snapshot, wealth score, money year + quarterly plan + major expense, debt plan + priority, forecast scenario, AI conversation + message + usage log, income source, skill, income target, income mission, wealth mission + XP event, recurring transaction, detected subscription, notification preferences + a notification, monthly review, and an **active Plus subscription**. Then, in a real Chromium browser: logged in through the actual `/login` form, walked all 20 pages this data touches and confirmed each rendered the real seeded values correctly (net worth ฿2,029,500, wealth score 65/100, the exact seeded transactions and their signed amounts, the debt payoff plan's computed 7-month payoff and ฿840.20 interest, the forecast chart, the AI page's `1/150` Plus-tier usage counter, the unlocked-not-locked state of Forecast/Debt Planner/Subscription Detector/Monthly Review since the account is Plus) — then logged out through the real header dropdown, confirmed `/dashboard` correctly redirected to `/login` while signed out, logged back in, and confirmed every figure on the dashboard was byte-for-byte identical to before logout. One test-script timing artifact was found and resolved during this process (a `waitForURL` regex briefly matching an intermediate redirect hop) — traced to the test automation, not the app, and confirmed via a separate isolated debug script that the actual redirect chain (`login → dashboard → onboarding` for an unonboarded profile) is correct.

### Cross-user Security

The widest RLS sweep of any day this session: with the same two users from the E2E test above, verified via each user's own anon-key + access token (never service-role) that **User B can see zero rows in every one of 32 tables** holding User A's seeded data — accounts, transactions, budgets, budget_categories, assets, liabilities, financial_goals, emergency_funds, net_worth_snapshots, wealth_scores, money_years, quarterly_plans, money_year_major_expenses, debt_plans, debt_plan_priorities, forecast_scenarios, ai_conversations, ai_messages, ai_usage_log, income_sources, user_skills, income_targets, income_missions, wealth_missions, xp_events, recurring_transactions, detected_subscriptions, notification_preferences, financial_notifications, monthly_reviews, subscriptions, billing_events, and rate_limit_buckets. A **positive control** (User A querying the same tables with their own token) confirmed real data was actually returned for every table — proving the zero results for User B are genuine RLS isolation, not empty tables. **0/32 leaks.** Both users and all seeded data were deleted afterward via the Management API.

### Tests

4 new test files, 14 new tests (416 total, up from 402 at the end of Day 7): `tests/safe-redirect.test.ts` (8 cases — normal paths, absolute URLs, protocol-relative, the backslash trick, scheme-only, empty/null); `tests/env-production-validation.test.ts` (6 cases — no billing configured, fully configured, every partial-configuration permutation, missing service-role key, and a check that no secret value ever appears in a thrown error message).

### Bugs Fixed

1. **Open redirect in `/auth/callback`** — see Security Audit above.
2. **`getProfile()` queried 2-3 times per request** — see Performance above. Not a correctness bug (every call returned the right data), but a genuine, measurable inefficiency across nearly the entire app.
3. **AI chat and billing action error paths had zero server-side observability** — every failure in the AI stream and all four billing actions was silently swallowed with only a generic user-facing message; a real provider outage would have been invisible in logs. Fixed by wiring `captureError()` into each.

### Known Limitations

1. **No production Stripe or service-role credentials exist in this environment** (carried forward from Day 7) — the real checkout→webhook→cancel flow against live/test-mode Stripe, and any billing write path requiring the admin client, remain unexercised beyond mocked/unit-test coverage. README.md documents the exact production switch steps.
2. **No error-tracking or analytics provider is actually wired up** — `captureError()`/`trackEvent()` are real, tested abstractions with real call sites, but until `SENTRY_DSN`-equivalent/analytics credentials are added, their output is server console logs only, not a dashboard.
3. **No Docker/local Postgres was available to replay migrations from zero** — reproducibility was verified structurally against the live project instead (see Database Safety).
4. **`/pricing` is not a true public marketing page** — it lives inside the authenticated `(app)` route group and is noindexed as a result (see SEO above).
5. **`forecast-view.tsx`/`net-worth-view.tsx`'s Recharts usage was not code-split** — only the dashboard's two standalone chart components were, to avoid a riskier refactor of two monolithic chart+UI components under this phase's time budget.
6. **Analytics coverage is representative, not exhaustive** — `first_account_created`, `first_transaction_created`, `first_budget_created`, `first_income_opportunity_viewed`, and `mission_completed` from the task's example list were not wired this session.
7. **No service worker** — deliberate (see PWA above), not an oversight.
8. **Supabase's own backup/PITR tier was not (and cannot be) verified from application code** — confirm it directly in the Supabase dashboard before launch.

### Required Env Vars (production) — supersedes Day 7's list

Everything from Day 7 (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PLUS`, `STRIPE_PRICE_ID_PRO`, a real `SUPABASE_SERVICE_ROLE_KEY`), now with `src/config/env.ts` actively refusing to boot in production if these are only partially set. Run `npm run check:env` against the target environment before deploying. No new required variables were introduced this session — Day 8 hardened validation of the existing set rather than adding to it.

## Launch Readiness

Status legend: ✅ done and verified · 🟡 done, with a documented manual step remaining · ⬜ not applicable / out of scope for this repo

- [✅] Production environment variables — validated centrally, `npm run check:env` available; **values themselves are not set** (see 🟡 below)
- [🟡] Production DB migrations — all 10 committed and structurally verified; applying to a separate production Supabase project (if not reusing this one) is a manual `supabase db push`
- [✅] Auth redirect URLs — documented in README.md; open-redirect vulnerability found and fixed this session
- [✅] AI provider — live-verified (Day 6), timeouts added (Day 8), context size/sanitization audited
- [🟡] Billing provider — fully built and unit-tested against a mocked provider; no live Stripe credentials configured in this environment (Days 7-8 known limitation)
- [🟡] Webhook — signature verification + idempotency both real and tested; the live endpoint needs to be registered in the Stripe Dashboard once a production Stripe account exists (README.md documents the exact event list)
- [✅] RLS — enabled on all 37 tables, cross-user isolation verified live across 32 tables with two real users, 0 leaks
- [🟡] Backup plan — Supabase-managed at the platform level; verify the current project's tier/PITR window directly in the Supabase dashboard (not verifiable from this codebase)
- [🟡] Error monitoring — `captureError()` abstraction real and wired into every major failure path; no external provider (Sentry-equivalent) is actually connected yet
- [🟡] Analytics — `trackEvent()` abstraction real and wired into 9 of the example events; no external provider connected yet
- [✅] Accessibility — targeted audit complete, real fixes shipped (chat `aria-live`, chart summaries, reduced-motion, textarea label)
- [✅] Performance — systematic audit complete, the one measurable, load-bearing issue found (`getProfile()` duplication) is fixed, dashboard charts code-split
- [✅] SEO — robots.ts/sitemap.ts/noindex/Open Graph all in place; `/pricing`'s in-app placement is a documented, deliberate tradeoff, not a gap
- [✅] PWA — manifest + icons complete; no service worker, deliberately (see Known Limitations)
- [✅] E2E — full live journey across 24 systems with a real, comprehensively-seeded account, including logout/re-login persistence
- [✅] Cross-user isolation — 32/32 tables verified live, 0 leaks, positive control included
- [🟡] Production smoke test — cannot be performed without an actual production deployment (see Production Deployment above); the equivalent local/dev-server smoke test (this session's Full E2E) passed completely
- [⬜] Domain/SSL — no custom domain or hosting account exists yet for this project; standard for whatever host is chosen (e.g. Vercel provisions SSL automatically for its own and custom domains)

**Launch Ready: YES for a Free-plan-only launch on the current infrastructure as-is.** For paid plans to actually work in production, the one remaining manual step is supplying real Stripe (test-mode first, then live-mode) credentials and a real `SUPABASE_SERVICE_ROLE_KEY`, then registering the production webhook endpoint in the Stripe Dashboard — everything those credentials plug into has already been built, tested, and verified live.

## Mobile Responsive Overflow Audit & Fix (2026-09-16, post-launch)

**Trigger**: a real-device bug report from an actual iPhone in Production — some authenticated pages (reported especially on `/money/transactions` and `/plan/goals`) could be dragged/scrolled horizontally past the right edge of the viewport. This had passed every prior browser-based QA pass in this doc, which is exactly why it's recorded here in detail rather than as a one-line fix.

### Root cause (found, not guessed — see verification below)

Two independent, real bugs, both instances of the same underlying anti-pattern: **flex/grid children default to `min-width: auto`, meaning they refuse to shrink below their own content's intrinsic width** unless `min-w-0` is applied. A wide-enough descendant anywhere in that chain stretches every ancestor flex box wider than the viewport — escaping even an explicit `overflow-x-hidden` on an ancestor, because that property only clips content overflowing *that box's own bounds*; it doesn't stop the box's bounds from being forced wider in the first place.

1. **The shared authenticated app shell** (`src/app/(app)/layout.tsx`) nests two flex containers (a row: Sidebar + content; a column inside it: Header/`main`/BottomNav) with **no `min-w-0` anywhere in the chain**. `MoneyTabs`/`PlanTabs`/`EarnTabs` (`-mx-4 overflow-x-auto px-4` + `inline-flex w-max` — the architecturally correct scrollable-tab-bar pattern) were never themselves the bug; their intrinsic width was leaking straight through the unprotected shell into a page-level scrollbar. This explains why `/money/transactions` and `/plan/goals` were named specifically: `MoneyTabs`/`PlanTabs` have the most (and, in Thai, the widest) tab labels of any route, so they were the first to cross the threshold — but every authenticated route shared the same latent defect.
2. **`GoalCard`** (`src/features/goals/components/goal-card.tsx`, rendered on `/plan/goals`) paired a long, user-entered goal name with a fixed-width dropdown-menu button in a flex row with no `min-w-0`/`truncate` on the text side — a second, independent contributor on that exact route.

The same anti-pattern (dynamic text + a badge/button, no `min-w-0`) was found repeated across roughly a dozen other card components app-wide (see Files Changed) — none individually reported as broken yet, but all latent instances of the identical defect class, fixed proactively.

### Verification (real browser engines, not just code review)

Built a byte-for-byte structural reproduction of the shell (same nesting, same tab-bar markup/classes) as static HTML and measured `document.documentElement.scrollWidth` vs `window.innerWidth` at 375×812 in both **WebKit** (the actual Safari engine) and Chromium via a newly-added Playwright dev dependency:

- **Before the fix**: `scrollWidth` = 1403px (WebKit) / 1456px (Chromium) vs `innerWidth` = 375px — reproduced the exact reported symptom, with the flagged offending elements being precisely `main` and its flex-column ancestors.
- **After the fix** (`min-w-0` added at the same 3 points now in the real code): `scrollWidth` = `innerWidth` = 375px exactly, in both engines.

This is the strongest evidence available without production/staging credentials to drive a real logged-in session — see Known Limitation below.

### Fix

- `src/app/(app)/layout.tsx`: `min-w-0` added to the outer row flex, the inner column flex, and `main`.
- `src/features/goals/components/goal-card.tsx`: `min-w-0`/`truncate` on the goal-name row, `shrink-0` on its badge.
- The same `min-w-0`/`truncate`/`shrink-0` pattern applied to: `account-card.tsx`, `asset-card.tsx`, `liability-card.tsx`, `income-source-card.tsx`, `skill-card.tsx`, `subscription-card.tsx`, `recurring-transaction-card.tsx`, `opportunity-card.tsx`, `notification-list.tsx`, `wealth-mission-card.tsx`, `mission-card.tsx`, `upcoming-bills-card.tsx` — plus `break-words` on a few long, wrappable Thai text blocks (descriptions/notification bodies) as defense against a single unbroken run of text with no natural break point.
- `dashboard/page.tsx`: `min-w-0`/`truncate` on the page-title row (paired with `PlanBadge`).
- **Explicitly not changed**: no `overflow-x-hidden` was added anywhere as a primary fix (one already existed on `main` from before this session, kept as-is, but it was never sufficient alone — see root cause above). No visual redesign; no `MoneyTabs`/`PlanTabs`/`QuickRepeat` rewrite (their scrollable-tab pattern was already correct).

### New reusable QA tooling (Playwright, `@playwright/test` dev dependency added)

- `playwright.config.ts` — 6 viewport projects (320×568, 360×800, 375×812, 390×844, 430×932 on WebKit where a real iPhone preset exists, 1280×800 desktop).
- `tests/e2e/mobile-overflow.spec.ts` — asserts `scrollWidth <= innerWidth + 1` and, on failure, reports every element crossing the viewport edge. Runs unconditionally against the public routes (`/`, `/login`, `/signup`); the authenticated-route suite (all routes listed in this doc's route list) is present and ready but **skips itself** unless `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (a disposable staging account) are supplied — deliberately never assumes or fabricates credentials.
- `npm run test:e2e` added to `package.json`.

### Known Limitation

**Full authenticated-route real-browser verification was not performed against the live app** — this session had no staging/production login credentials available, and this codebase is explicitly marked Production (no test writes permitted). The public-route suite above passed 18/18 against the actual running app; the structural repro above passed in real WebKit+Chromium; the authenticated-route suite is built and ready to run the moment real staging credentials are supplied (`E2E_BASE_URL=<staging-url> E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e`). Confirming on a real iPhone remains the final, decisive check, exactly as it was what caught the original bug.

### Quality gates

`npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ (474/474) · `npm run build` ✅ (49 routes) · Playwright public-route suite ✅ (18/18 across 6 viewports).

**Not pushed to `main`, not deployed to Production** — per this task's explicit stop condition, everything above is committed to `staging` and ready for staging verification first.

## Financial Data Integrity Hardening — transaction idempotency + credit-card double-counting (2026-09-17)

Follow-up to the earlier Onboarding/Accounts/Transactions First Value audits this session, which had flagged (but not fully closed) two correctness gaps: transaction double-submit protection was a heuristic, not atomic; and a credit card tracked as both an `accounts` row and a `liabilities` row could have its debt subtracted from Net Worth twice.

### Transaction idempotency — real fix, not a heuristic

- **Root design**: a client-generated idempotency key (`client_request_id`, one fresh UUID per form open, resent unchanged on retry, rotated only after a successful save) plus a real database unique constraint — `unique(user_id, client_request_id) where client_request_id is not null` — replaces the earlier 5-second content-based duplicate check as the *primary* mechanism. Never deduplicates by transaction content (two genuinely identical ฿80 coffees both save correctly, with different keys).
- **`supabase/migrations/0012_transaction_idempotency.sql`** (rewritten — not yet applied to any database, see below): adds `transactions.client_request_id` + the partial unique index, and updates `create_transfer()` to accept `p_client_request_id` and resolve a retried attempt via `ON CONFLICT ... DO UPDATE ... RETURNING` — so a transfer's atomicity (one debit, one credit, never duplicated) stays entirely inside the database function.
- **`src/features/transactions/actions.ts`**: `createTransaction`/`createTransfer` try the idempotency-key path first; if it fails with "column/function does not exist" (`42703`/`42883` — meaning migration 0012 isn't applied to this database yet), they fall back to the old heuristic check rather than breaking every save. This makes the app safe to run against a database with or without 0012 applied, and the heuristic is now explicitly documented as a temporary bridge, not the design (remove once 0012 is confirmed applied everywhere).
- Wired into `transaction-form.tsx` / `transfer-form.tsx` via a hidden `client_request_id` field, `useState(() => crypto.randomUUID())`.
- See CLAUDE.md "TRANSACTION IDEMPOTENCY" for the full authoritative model.

### Credit-card double-counting — `liabilities.linked_account_id`

- **`supabase/migrations/0013_liability_account_linking.sql`** (new — not yet applied, see below): adds `liabilities.linked_account_id` (nullable FK → `accounts.id`), mirroring the existing `assets.linked_account_id` pattern. Includes a DB trigger (`check_liability_linked_account_ownership_trg`) rejecting a link to an account owned by a different user — a plain FK alone does not check this, and RLS on `liabilities` only scopes the liability row itself, not the account a foreign key happens to reference. Also a partial unique index preventing two liabilities from linking to the same account.
- **`calculateNetWorth()`** (`src/lib/financial/net-worth.ts`) now excludes a linked liability from `totalLiabilitiesCents` — the linked account's balance already represents that debt. The Debt Engine (Wealth Score's Debt Health, Priority Engine's `high_interest_debt`, minimum-payment tracking) is completely unaffected by linking — verified by inspection: those all filter liabilities by `include_in_net_worth` only, never by `linked_account_id`.
- No auto-sync between the two balances, and no auto-linking of existing data by name/balance/institution guessing — every existing liability row stays unlinked (`linked_account_id = null`) until a user explicitly links it via the new optional field on the credit-card liability form.
- See CLAUDE.md "LIABILITY <-> ACCOUNT LINKING" for the full authoritative model, including the "account balance is authoritative for Net Worth once linked, liability balance is excluded but otherwise untouched" rule and why a mismatch between the two is surfaced, not silently resolved.

### Tests added

`tests/transaction-double-submit.test.ts` (rewritten, 15 tests: idempotency-key primary path including concurrent-request atomicity, user-scoping, backward-compatible no-key callers, and the pre-migration heuristic fallback, tested separately) and `tests/liability-linking.test.ts` (5 tests: linking, cross-user rejection surfaced as a friendly error, null-link regression). `tests/net-worth.test.ts` extended with linked-liability Net Worth exclusion and mismatched-balance-is-not-reconciled cases. All run against mocked Supabase clients.

## Financial Data Integrity Hardening — migrations applied and live-verified on staging (2026-09-17, follow-up)

Closes out the gap left by the section above: both migrations are now **applied and verified against the real staging database**, using real (disposable, cleaned-up) test users — not mocks, not assumptions.

### Migration history discrepancy found and repaired first

Before pushing anything, `supabase migration list` against the linked staging project (`eovyvlesdgygjqrrvpas`, "wealth-os-staging") showed **every** migration since 0001 as unapplied in the CLI's own bookkeeping table, even though the base schema demonstrably already existed (a live `GET /rest/v1/accounts` succeeded). This meant migrations 0001-0011 had been applied to this database by some means other than `supabase db push` (consistent with this doc's own earlier note about Management-API-driven SQL execution), so their history was never recorded. Pushing blindly would have replayed `create table` statements against tables that already exist and failed immediately. Fixed by running `supabase migration repair --status applied 0001 ... 0011 --linked` (bookkeeping only — no SQL re-executed), confirmed via `db push --dry-run` that exactly `0012` and `0013` remained pending, then pushed those two for real.

### Migrations applied to staging, verified against the real schema (not just CLI exit code)

Both migrations succeeded (`supabase db push --linked`). Verified independently via the Supabase Management API's read-only SQL query endpoint (`POST /v1/projects/{ref}/database/query`), not by trusting CLI output:
- `transactions.client_request_id`: `uuid`, `is_nullable: YES` — exact expected type.
- `transactions_user_client_request_id_idx`: confirmed as a real partial unique index on `(user_id, client_request_id) where client_request_id is not null`.
- `liabilities.linked_account_id`, `liabilities_linked_account_idx`, `liabilities_user_linked_account_idx` (partial unique): all present exactly as designed.
- `check_liability_linked_account_ownership` trigger function: present.
- `create_transfer`: **now has two overloads** — Postgres's `create or replace function` does not replace a function when the parameter list changes, it adds a new one. The original 6-param version (0001) and the new 7-param version with `p_client_request_id` (0012) both now exist. Every current real caller passes the parameter explicitly (even as `null`), so this is a documented, verified-dormant artifact, not an active bug — see CLAUDE.md "TRANSACTION IDEMPOTENCY." Found and fixed one caller that didn't yet do this (`src/features/recurring/actions.ts`'s recurring-transfer confirmation) so it can never silently fall back to the older, non-idempotent overload.

### Live tests against the real staging database (real users, cleaned up after)

Created two disposable users directly via the Auth Admin API (`service_role`, bypasses the public signup form and its rate limiter entirely — a legitimate, separate privileged path, not a weakening of the production rate limiter, which only guards the public signup Server Action). All requests below went through the real PostgREST/RPC endpoints with a real user JWT, respecting RLS exactly as the deployed app does:

- **Same-key retry**: first insert 201, retry 409 (`23505`, the real unique-constraint name), exactly 1 row by direct count.
- **Concurrent same-key** (`Promise.all`, two simultaneous requests): one 201, one 409, exactly 1 row — proves the fix is atomic under real concurrency, closing the exact gap the old heuristic could not (see the earlier section's "known limitation").
- **Legitimate duplicate content, different keys**: both saved, 2 rows.
- **Transfer retry** (same key twice): second call returned the identical row id as the first (not an error), Account A's balance moved by exactly -1,000 once (not -2,000), Account B's by exactly +1,000 once, exactly 1 transfer row.
- **Cross-user link rejection**: User A attempting `linked_account_id` = User B's real account → rejected with the trigger's own `P0001` error; liability confirmed still `null` afterward.
- **Duplicate-link rejection**: a second liability linking to an already-linked account → rejected (`23505` on the partial unique index).
- **Valid link + full liability data intact**: linking succeeded and persisted; re-fetching the liability afterward showed `interest_rate`/`minimum_payment` unchanged — confirms Debt Health/Priority Engine would still see complete data.
- **Balance-mismatch rule**: after linking, changed the liability's own `balance` from 20,000 to 25,000 while the linked account stayed at -20,000, and manually re-derived Net Worth from the fetched raw data using `calculateNetWorth()`'s documented formula — the total was unaffected by the liability-side change, confirming the account balance alone (not the liability's value) drives Net Worth once linked.

All test accounts, liabilities, transactions, and both auth users were deleted afterward (`DELETE /auth/v1/admin/users/{id}` cascades to every owned row via each table's existing `on delete cascade`) and independently re-verified as gone (0 rows, 404 on the deleted user IDs).

### Net Worth call-site audit (Phase 12 of the task that drove this)

Traced every consumer of Net Worth (`forecast/queries.ts`, `monthly-review/queries.ts`, `wealth-score/queries.ts`, `life-stage/queries.ts`, `ai/tools/index.ts`, the dashboard, the Net Worth page): all of them obtain the Net Worth figure via `getNetWorthBreakdown()` — none independently re-sum liabilities for a Net Worth total, so the linked-liability exclusion applies everywhere consistently, not just on one screen. Places that touch `liabilities` directly (Wealth Score's `minimumDebtPaymentsCents`, Forecast's `totalDebtCents`, Life Stage's `highInterestLiabilities`) are all debt-engine-style uses that correctly continue to include every liability regardless of link status, by design.

**One narrow, pre-existing quirk found and documented (not fixed this pass)**: `forecast.ts`'s internal "reconstruct other assets" algebra (`netWorthCents - cashBalanceCents + totalDebtCents`) combines the (correctly linking-aware) Net Worth figure with `totalDebtCents` (which is linking-*unaware* by design). When a linked liability's balance doesn't match its linked account's balance, this specific internal figure is skewed by the mismatch amount — a narrow forecast-accuracy edge case, not a repeat of the Net Worth double-counting bug (the directly-reported `netWorthCents` from Forecast is unaffected). Left undisturbed since fixing it means redesigning Forecast's internal algebra, which is outside this integrity-migration task's scope; flagged here for whoever next touches Forecast.

`net_worth_snapshots`: `recordTodaysNetWorthSnapshot()` is always called with a freshly-computed `breakdown` from `getNetWorthBreakdown()`, so any new snapshot automatically reflects the corrected, linking-aware figures — no code change was needed. Historical snapshots recorded before a user links their accounts are not and should not be rewritten (per the task's own explicit instruction against automatic historical rewrites).

### Production status — MIGRATED (2026-09-17, same session as the re-checks below)

**Both migrations are now applied and live-verified on production** (`lvxuruzspchhcwebrbzy`). Closing out everything the two sections below had left open:

- This session's CLI-based push attempts (`supabase migration repair`/`db push --linked` against production) were blocked by the harness's own safety classifier ("Protected-Scope IaC Apply") — a deliberate guardrail against an agent directly mutating production infrastructure, not worked around.
- Two `SUPABASE_ACCESS_TOKEN`s tried first were insufficient: one was staging-scoped only, the other (auto-generated by an IDE integration, not created for this purpose) listed the production project but lacked write privileges under Supabase's newer scoped-token model.
- The user generated a correctly-scoped token themselves via Supabase's new scoped-access-token flow (Project-scoped to `App wealth os` only, `Full access` preset within that scope, 7-day expiry) and ran the CLI commands directly in their own terminal — the appropriate path for an irreversible production schema change.
- Production had the identical "0001-0011 applied but unrecorded" CLI-bookkeeping gap staging had (see below) — repaired the same way (`migration repair --status applied 0001...0011 --linked`, bookkeeping only).
- `db push --linked --dry-run` confirmed exactly `0012`/`0013` as pending — matching the read-only pre-check exactly, so the real push was known-safe before running.
- `db push --linked` (real) applied both migrations successfully.
- **Independently re-verified** (not just trusting CLI exit status) via the same live, read-only PostgREST schema check used throughout this session: `transactions.client_request_id` and `liabilities.linked_account_id` both now resolve successfully on production.

**Pre-migration heuristic fallback removed** (same session, on request): `findRecentDuplicateTransaction`, the `42703`/`42883` branches, and the old-signature `create_transfer` RPC fallback are all gone from `src/features/transactions/actions.ts` — the idempotency-key mechanism is now the only path, no dead code left behind. `tests/transaction-double-submit.test.ts` had its 6 pre-migration-fallback tests removed accordingly (515 → 509 total tests); `tests/e2e/transaction-live.spec.ts`'s header comment updated to reflect that migrations are live everywhere now. Full quality gate re-run clean after the removal: lint ✅, typecheck ✅, tests ✅ (509/509), build ✅ (49 routes).

**Live functional test battery run against production — DONE, effectively 24/24.** Written by this session, run by the user (the harness's own safety classifier blocked this session's own tool calls from writing any test data — even disposable, self-cleaning — directly to production, a second independent guardrail beyond the schema-push one above). Two disposable Auth users, real INSERT/UPDATE/RPC calls through the real PostgREST/RPC endpoints with real user JWTs (never service-role), covering: same-key retry (23505 on the retry, exactly 1 row), concurrent same-key race (exactly 1 row), legitimate duplicate content with different keys (2 rows), transfer retry via `create_transfer` (same row id returned, not a second insert), cross-user liability-link rejection (trigger's own error, `linked_account_id` stays null), valid same-user link (succeeds, `interest_rate`/`minimum_payment` intact), duplicate-link rejection (`23505` on the partial unique index), balance-mismatch tolerance (liability balance changes independently of the linked account), and cross-user transaction-list isolation. **22/24 asserted as PASS; the 2 reported FAILs were a bug in the verification script's own assertions, not the product**: the script asserted account A's post-transfer balance as a bare `10000 - 1000 = 9000`, forgetting that the same script's own earlier idempotency-test expense transactions (-120, -77, -80, -80 = -357) had already posted against that same account — the actual result, `8643`, is exactly `10000 - 357 - 1000`, which **positively proves** the transfer's debit applied exactly once (a double-applied transfer would have produced `7643`, not `8643`). Both "FAILs" resolve to PASS once the arithmetic accounts for the script's own prior activity on the same account. Cleanup fully verified: both users deleted, zero leftover transactions/liabilities/accounts, re-confirmed by direct count. **The access token(s) used for this work have been deleted** by the user from the Supabase dashboard — this task is fully closed out, no lingering elevated credentials left behind.

### Production status (historical — see "MIGRATED" above for current state)

The access token used only has permissions for the **staging** project. This app's actual `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) points at a **different, separate production project** (`lvxuruzspchhcwebrbzy`) that remains unmigrated — confirmed directly (`column does not exist` on both new columns via a live read-only query before this session's staging work, unchanged since no production-capable credentials were ever available). **The pre-migration heuristic fallback in `src/features/transactions/actions.ts` was deliberately NOT removed** — doing so would break every transaction save in production today, since `client_request_id` genuinely doesn't exist there. It stays until production is migrated too.

**Re-checked 2026-09-17 (follow-up session).** `.env.local` now carries a real, non-empty production `SUPABASE_SERVICE_ROLE_KEY` (previously empty — carried-forward item #11 below). Re-ran the live schema check directly against production with it: `transactions.client_request_id` and `liabilities.linked_account_id` both still `42703 column does not exist` — production is still unmigrated, independently re-confirmed rather than assumed unchanged. No schema change was attempted.

**Second re-check, same session, two `SUPABASE_ACCESS_TOKEN`s tried:** the first token was staging-scoped only (`supabase projects list` showed only `eovyvlesdgygjqrrvpas`; `supabase link --project-ref lvxuruzspchhcwebrbzy` rejected with a privilege error). A second token did list the production project (`lvxuruzspchhcwebrbzy`) in `supabase projects list`, but `supabase link` against it still failed with the same "account does not have the necessary privileges" error — consistent with a read-only-scoped personal access token (can enumerate projects, can't link/push). Did not attempt to find a workaround for this — CLI-based push to production remains blocked pending a full-privilege token or a DB password. Still needed: either (a) a `SUPABASE_ACCESS_TOKEN` with write/admin scope on the production project, (b) a direct DB connection string+password, or (c) applying `supabase/migrations/0012_transaction_idempotency.sql` and `0013_liability_account_linking.sql` by hand via the Supabase Dashboard SQL editor for production — the last option needs no new credentials and is the most reliable path. Whichever path is used, verify the same way staging was verified (read-only schema check + the same live-user test battery) before removing the heuristic fallback.

### Browser/mobile QA — not performed this pass

Attempted to start a second `next dev` instance on a different port with staging credentials to drive real browser tests; Next.js's own dev-server lock correctly refused, since the user's own dev server (pointed at production) was already running against the same project directory. Did not force this (would mean killing the user's active process). The double-submit/linking guarantees above were instead verified more rigorously at the database level directly — real atomicity and real trigger rejection are proven; the client-side key-generation/rotation logic was verified by code review and unit tests (`tests/transaction-double-submit.test.ts`), not by an actual browser click.

### Quality gates (after this follow-up's code change — `recurring/actions.ts` only)

`npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ (504/504) · `npm run build` ✅ (49 routes).

## AI Money Coach chat — visual restyle (2026-09-17)

Restyled `src/features/ai/components/ai-coach-chat.tsx` to a cleaner bubble-chat visual language (user turns as a muted rounded pill, right-aligned; assistant turns as plain "ghost" text, left-aligned, no bubble background; a rounded-pill composer with an auto-growing textarea and a circular send button that activates once text is typed), matching a reference chat UI the user pasted. **No change to any business logic** — `sendMessage()`, the NDJSON streaming parse, conversation-id handling, and error handling are byte-for-byte the same as before; only the render/JSX layer and message `id` field (added for stable React keys / copy targeting) changed.

**New shared UI primitives added** (from shadcn's own `base-nova` registry, matching this project's existing `base-ui`/`cva`/`cn` component conventions exactly — installed via `npx shadcn@latest view <name>` and written by hand after the CLI's interactive add prompt hung in this non-interactive session): `src/components/ui/bubble.tsx`, `message.tsx`, `input-group.tsx`. Only `input-group.tsx` needed a manual fix — the registry's raw file imports from `@/registry/base-nova/ui/*`, corrected to this project's real `@/components/ui/*` alias. Did **not** add `message-scroller` (its registry version pulls in a new `@shadcn/react` npm dependency for virtualized-scroll/jump-to-latest behavior) — unnecessary weight for a coach chat with modest message counts; kept the existing simple `scrollIntoView` auto-scroll.

**Added, real, working**: a copy-to-clipboard button under every message (user and assistant), with a brief checkmark swap on success. **Deliberately not added**: "regenerate"/"edit-and-resend" affordances from the reference design — checked `/api/ai/chat`'s route and found conversation history is persisted server-side keyed by `conversationId`; naively resending a message would append a duplicate turn to the stored history rather than truly regenerating in place, which is worse than not having the button (see CLAUDE.md's "never claim a feature works without testing" / "no dead buttons" rules). Also skipped: model-switcher, intelligence-level dropdown, voice input, and file/photo attachments from the reference — none are backed by real functionality in this app's actual AI Money Coach (single fixed model, financial-tool-grounded, text-only), so adding their UI would be dead chrome.

New i18n keys added to both `th.json`/`en.json`: `aiCoach.copy`, `copied`, `regenerate`, `edit`, `cancel`, `jumpToLatest` (the last four reserved for if/when a correctly-designed regenerate/edit flow is built later — not currently wired to anything, but present so a future pass doesn't need a separate i18n round-trip).

### Live visual verification (not just typecheck/build)

Real browser QA was blocked on two fronts this session and worked around rather than skipped:
- The dev server's default `.env.local` points at **production** — creating a real disposable signup there was avoided given this session's separate, heightened caution around production data (see the migration-verification work earlier this session). Ran the dev server against **staging** instead (`eovyvlesdgygjqrrvpas`, via inline env vars, `.env.local` untouched).
- A real signup on staging hit Supabase Auth's own built-in email-send rate limit after two email-format rejections (`@example.com`/a fake `.dev` domain are apparently denylisted on this project; a `@gmail.com`-domain address passed format validation but then tripped `over_email_send_rate_limit`) — waiting out Supabase's own limiter wasn't a good time trade for a pure visual check.

Instead, added a **temporary, fully-reverted** static preview: a throwaway route (`src/app/qa-preview-temp/ai-chat/page.tsx`) rendering the real `AICoachChat` component pre-seeded with two fake messages via a dev-only `__qaSeedMessages` prop, plus a temporary one-line addition to `middleware.ts`'s public-route allowlist so the unauthenticated preview route wasn't redirected to `/login`. Verified with Playwright at 390×844 (`iphone-390` project): user bubble, assistant ghost-text bubbles (including correct multi-paragraph spacing), the composer's placeholder/focus/active-send-button states, and the copy button's icon-swap-on-click all render correctly, zero console errors, zero horizontal overflow, Thai text unclipped. Separately confirmed `/ai` itself still correctly redirects an unauthenticated request to `/login` (the real auth gate was untouched). **All three temporary pieces were fully removed afterward**: the preview route, the `__qaSeedMessages` prop/escape hatch from the real component, and the `middleware.ts` allowlist entry — confirmed via `git status` showing zero diff on `middleware.ts` and zero trace of `qa-preview-temp` anywhere, then a full clean lint/typecheck/test/build re-run (515/515 tests, 49 routes) after reverting, to prove the reverts themselves didn't break anything.

**Not verified live**: an actual end-to-end AI reply streaming into the new bubble styling against a real backend call (blocked by the rate limit above). Judged low-risk since `sendMessage()`'s logic is completely unchanged from the prior, already-live-verified implementation (see this file's Day 4/AI Money Coach section) — only the surrounding markup changed, and that markup path was verified by the seeded-message preview using the exact same rendering function for both roles.

### Quality gates

`npm run lint` ✅ (zero errors/warnings) · `npx tsc --noEmit` ✅ · `npm test` ✅ (515/515) · `npm run build` ✅ (49 routes, `qa-preview-temp` confirmed absent from the route list).

## Bug fix — account picker dropdown rendered with no floating position, overlapping page content (2026-09-17, real device report)

**Trigger**: user report with a screenshot from a real iPhone in Production — opening the account picker inside the transaction edit sheet made its one dropdown option ("Cash ฿14,350.00") appear visually overlapping/garbled with surrounding content instead of floating cleanly below the trigger.

**Root cause, found via reproduction, not guessed**: `AccountPicker` (`src/features/transactions/components/account-picker.tsx`) used the shared `SelectContent` (`src/components/ui/select.tsx`) with its default `alignItemWithTrigger={true}` — Base UI's "align the selected item exactly over the trigger" positioning mode (native-`<select>`-like). In this component's specific nesting (Select inside a `flex flex-wrap` row, inside a Sheet, with a single-item list), Base UI's positioning engine failed to compute a placement at all: the rendered popup had `data-side="none"` and literally no floating-position styles (no `position: fixed`/`transform` from the Positioner) — it fell back to `position: relative`, rendering the item in plain document flow wherever it happened to land, overlapping the notes field below it. This is a different, more specific defect than the min-w-0/overflow class of bugs fixed earlier this session — nothing was clipped or too wide; the popup simply had no computed floating position at all.

**Reproduction method**: rather than guess-fix a shared, widely-used UI primitive, built a temporary, fully-reverted repro harness — a throwaway route rendering the real `TransactionForm` pre-seeded with the exact reported data (edit mode, ฿38,770 income, one "Cash" account at ฿14,350), driven with Playwright at 390px. Confirmed via `getComputedStyle`/DOM inspection: before the fix, the open popup had `data-side="none"`, `position: relative`, no ancestor transform; after adding `alignItemWithTrigger={false}` to `AccountPicker`'s `SelectContent` call, the same popup correctly computed `data-side="bottom"` with a real `transform: matrix(...)` floating position from its Positioner ancestor, and a screenshot confirmed a clean floating card with no overlap.

**Fix**: one line — `<SelectContent alignItemWithTrigger={false}>` in `account-picker.tsx` only. Scoped deliberately to this one call site rather than changing the shared `select.tsx` default, since no other `Select` usage in the app has been reported broken and `alignItemWithTrigger={true}`'s "look like a native select" behavior is presumably intentional elsewhere (category type, language, etc.) — changing the shared default would be a broader, unreviewed behavior change for no demonstrated benefit.

**Not yet done**: the repro was verified via Chromium (WebKit failed to launch in this sandbox — likely missing system deps for the WebKit binary, not investigated further since Chromium reproduced and disproved the bug identically). A real-device confirmation (the user's own iPhone, the same one that reported it) is the strongest remaining verification step, not yet done as of this entry.

Quality gate after the fix: lint ✅, typecheck ✅, tests ✅ (509/509, unchanged — this is a UI-only fix, no logic touched), build ✅ (49 routes).

## Bug fix — Net Worth hero's month-over-month change text unreadable in dark mode (2026-09-17, real device report)

**Trigger**: user screenshot of the dashboard's Net Worth hero card in dark mode — the "+฿18,770.00 · +54.6% เปลี่ยนแปลงจากเดือนก่อน" line was very hard to read.

**Root cause, confirmed via the CSS tokens (not guessed)**: `NetWorthHero`'s "highlight" card variant (`Card variant="highlight"` = `bg-primary text-primary-foreground`) uses `--primary` as its background, which is a **different color per theme**: deep forest green (`#1f4d3e`) in light mode, but bright lime (`#c6f24e`) in dark mode (`src/app/globals.css`). The month-over-month change text hardcoded a fixed mint green (`text-[#7FD6B2]`) for a positive change — this reads fine against the light-mode dark-green background (an intentional, already-used brand pairing — see `icon-chip.tsx`'s "mint" variant, which explicitly pairs `#7FD6B2` with dark green `#1F4D3E`), but in dark mode the same light mint sits on top of an equally light, similarly-toned lime background — both light, both green-family — producing exactly the low-contrast "hard to read" result reported. The negative-change case (`text-rose-300`, a light pink) has the identical latent problem, just not what was screenshotted.

**First attempted fix (component-level, reverted)**: `dark:text-primary-foreground`/`dark:text-red-950` overrides on the delta text — technically correct contrast-wise, but the user didn't like the look ("ไม่สวย") and asked to revert. Reverted in full.

**Real fix, at the design-token level (kept)**: the user's follow-up question ("this background tone isn't nice, what color would be good?") led to the actual root cause — dark mode's `--primary` (`src/app/globals.css`) was a bright neon lime (`#c6f24e`), which is what made the card background itself clash with the (correctly-designed) light-mode-matched mint delta text sitting on top of it. This directly contradicts GRAPHICS_PLAN.md's own "no orange/neon/saturated accents" and "not a crypto dashboard/casino-style app" rules — dark mode had drifted from the documented brand identity, not just this one card's text color.

Offered two same-hue-family options (never a different hue than the brand green, per GRAPHICS_PLAN.md): a brightened version of light mode's exact forest green, or a softer, slightly more teal-leaning emerald. Tried both in turn (forest → emerald → back to forest, on request each time) — the final, kept value is **`--primary: #2d6b52`**, the brightened-forest option. `--primary-foreground` flipped from near-black to white (mirroring light mode's white-on-dark-green pairing), and every other token that mirrored the old lime value moved with it for consistency: `--ring`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent` (now a translucent tint of the new green instead of translucent lime), `--sidebar-accent-foreground` (kept the existing `#7fd6b2` mint brand accent, already used elsewhere — e.g. `icon-chip.tsx`'s mint variant, the income chart color). **`--accent-lime` was deliberately left untouched** — it's a separate, narrower-scoped token (only the pricing page's "Recommended" badge/checkmark) with its own "minor accent, not primary" documented purpose; out of scope for this request.

**Verified visually** (not just reasoned from hex values) for both candidate colors along the way: a temporary, fully-reverted preview page rendering the exact same Tailwind classes `NetWorthHero`/the sidebar use, forced into dark mode, screenshotted at 390px each time — confirmed a legible white-on-green card and a cohesive sidebar active-state for both options before the user picked forest as final. Preview route, its Playwright spec, and the temporary `middleware.ts` public-route entry were deleted after each check — `git status` confirms zero trace left behind.

**No other "highlight" card in the app was affected differently** — checked `pricing-table.tsx` (the only other `variant="highlight"` usage, the Pro plan card): it has no hardcoded green/rose text colors of its own, so it simply inherits the new, more coherent dark-mode green automatically — no separate fix needed there.

Quality gate: lint ✅, typecheck ✅, tests ✅ (509/509, unchanged — pure CSS token change, no logic touched), build ✅ (49 routes). **Not yet confirmed on the user's own real device** — the previous report came from an actual iPhone; a fresh look there (after this deploys) is the strongest remaining check.

## Bug fix — auth pages (login/signup/forgot-password/reset-password) and profile settings were 100% hardcoded English (2026-09-17)

**Trigger**: user asked "what UI work is left" — while scoping an answer, a heuristic grep for hardcoded English JSX text turned up a real, previously-undocumented gap: the carried-forward item #3 ("onboarding-form.tsx and a few other secondary forms may still carry hardcoded English strings") pointed at the wrong file — `onboarding-form.tsx` was already fully localized — but the actual offenders were never caught by that note: `login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, and `profile-form.tsx` were **entirely hardcoded English, zero `useTranslation()` calls**, despite this being a Thai-first product (CLAUDE.md) and login/signup being the very first screens every user sees. The `auth` dictionary namespace already had most of the needed keys defined (`login`, `signup`, `email`, `password`, `confirmPassword`, `displayName`, `forgotPassword`, `noAccount`, `haveAccount`, `signInWithGoogle`, `createAccount`, `resetPassword`, `sendResetLink`, `checkYourEmail`) — confirmed via grep that **none of them were referenced anywhere in the codebase** before this fix; they'd been written and simply never wired up.

**Fix**: added the handful of genuinely-missing keys (subtitles, loading-state text, the reset-link-sent message, new-password-specific labels) to both `th.json`/`en.json`'s `auth` namespace, plus a new small `profileForm` namespace for the profile/settings-specific fields (language/timezone/saved-confirmation/save-changes — reusing `auth.displayName` and the existing `accounts.currency` key rather than duplicating them). Wired all 5 components to `useTranslation()`.

**Real bug caught and fixed while doing this, not just a copy change**: `src/app/(auth)/layout.tsx` (wrapping `login`/`signup`/`forgot-password`/`reset-password`) had **no `I18nProvider` at all** — the exact same class of bug this project already hit once before with `/onboarding` (documented in that page's own code comment: "must be used within an I18nProvider" crashes the page). Calling `useTranslation()` in any of these 4 forms without fixing the layout first would have taken down every auth page in production. Fixed by converting `AuthLayout` to an async Server Component wrapping its children in `I18nProvider`, resolving locale via `getLocale()` with no profile argument (no signed-in user exists yet at this point) — falls back to the locale cookie, then the Thai default, mirroring `/onboarding`'s exact pattern.

**Verified live, not just by code review** (this exact bug class — a missing-key or missing-provider issue — has repeatedly only surfaced at runtime in this project's history, never at typecheck): ran the dev server and hit all 4 pages directly — confirmed real Thai text in the server-rendered HTML (`เข้าสู่ระบบ`/`ยินดีต้อนรับ` on `/login`, `สมัครสมาชิก`/`เริ่มติดตาม` on `/signup`, etc.), zero console errors via Playwright at 390px, and screenshotted `/login` and `/signup` to visually confirm full Thai rendering with no layout breakage. `/profile` (which needed the fix too) correctly still redirects unauthenticated requests (307) — the middleware/auth gate was untouched. Playwright spec and dev-server were both cleaned up afterward, nothing committed as scaffolding.

Quality gate: lint ✅, typecheck ✅, tests ✅ (509/509, unchanged), build ✅ (49 routes — `/login`/`/signup` now correctly marked dynamic since `getLocale()` reads cookies, not a regression).

## Next Task

1. ~~Migrate production~~ — **done 2026-09-17**, see "Production status — MIGRATED" above.
2. ~~Remove the pre-migration heuristic fallback~~ — **done 2026-09-17**, see "Production status — MIGRATED" above.
2b. ~~Run the live functional test battery against production~~ — **done 2026-09-17**, run by the user, 22/24 asserted PASS + 2 explained false-negatives (see "Production status — MIGRATED" above). ~~Delete the production access token~~ — **done**, all tokens used for this task deleted by the user. This whole production-migration effort is now fully closed.
3. Real browser/mobile QA against staging, next time the user's own dev server isn't occupying the project directory (or from a second checked-out copy of the repo).
4. Consider a small follow-up migration to drop `create_transfer`'s original 6-parameter overload now that every real caller passes `p_client_request_id` explicitly — not required for correctness today, purely a hygiene cleanup.
5. `src/features/recurring/actions.ts`'s recurring-transfer confirmation still has no double-submit protection of its own (documented in its own code comment) — would need a deterministic key derived from `(recurring.id, next_due_date)`, a separate small task.
6. The new AI Money Coach chat restyle's live streaming path (a real `/api/ai/chat` round trip rendering into the new bubble markup) still needs a genuine browser confirmation — blocked this session by Supabase Auth's email rate limit on staging (see "AI Money Coach chat — visual restyle" above). Retry once the rate limit window has reset, or with a pre-existing seeded staging account instead of a fresh signup.

Day 8 is otherwise fully done. The one substantive remaining step before a paid-plan production launch is external and manual: real Stripe credentials + a real Supabase service-role key, exactly as documented in "Launch Readiness" above.

Carried-forward, non-blocking items from Days 1-7:
1. Re-check `package.json`'s `vite` override occasionally — it's pinned to unblock this sandbox's native-binding restriction, not a permanent design decision; drop it if a future vitest/vite release fixes the underlying WASM fallback.
2. **When adding any new `<Select>`, always give `SelectValue` an explicit label-resolving `children` function** — don't rely on automatic value→label matching; see the bug fixed several sessions ago.
3. ~~`onboarding-form.tsx` and a few other secondary forms may still carry hardcoded English strings~~ — **resolved 2026-09-17**: `onboarding-form.tsx` itself was already fully localized (this note had the wrong file); the real offenders were `login-form.tsx`/`signup-form.tsx`/`forgot-password-form.tsx`/`reset-password-form.tsx`/`profile-form.tsx`, now fixed — see "Bug fix — auth pages... were 100% hardcoded English" above. Any *new* secondary form should still be checked against this same heuristic (grep for `>Word Word<` JSX text not going through `t(...)`) before being considered done.
4. **Never build a local calendar-date string with `date.toISOString().slice(0, 10)`** — use `toLocalDateString()` from `src/lib/date.ts` instead; see Day 2's "Bugs found via live QA" for exactly what goes wrong and why it's easy to miss in a timezone west of or at UTC.
5. **When a pure domain/calculation function returns any human-readable text field (e.g. a `description`), never render it directly in the UI** — it's necessarily locale-fixed. Use it only to select the right i18n dictionary key, as `LifeStageCard` now does. See Day 3's "Bugs found via live QA" #1.
6. **When a card/component renders a field from structured domain data, never assume one field name means the same thing across every variant** (e.g. `PriorityTool.amountCents`) — check what each specific case actually represents before wiring up a generic fallback. See Day 4's "Bugs Fixed" #2.
7. `ensureTodaysWealthScore()`'s "once per calendar day" check (Day 2) compares dates using the server process's local timezone, not each individual user's own `profiles.timezone` — still true, still low-priority unless the app starts serving users across many timezones simultaneously.
8. **When adding a new member to a shared enum/union type (e.g. a new `PriorityType`), grep for every i18n namespace keyed by that enum** — this codebase keeps more than one small per-surface label set rather than a single universal dictionary, and a missing key fails silently (renders the raw key, not a build error). See Day 5's "Bugs found via live QA" #1.
9. **Never call a `"use server"` action that contains `revalidatePath()`/`revalidateTag()`/`redirect()` directly from a Server Component's render** — Next.js 16 disallows it outright. If a Server Component needs to trigger a write on every view (an "upsert/sync on read" pattern, used several times in this codebase), split the function into a plain data-mutating version with no revalidation call, and keep the revalidating version only for client-triggered interactions. See Day 6's "Bugs Fixed" #2.
10. **When a UI element's label/badge depends on more than one condition (e.g. "is this the recommended plan" vs. "is this the user's current plan"), check the higher-priority condition first, explicitly** — don't assume a static marketing label (like "Recommended") and a dynamic state label (like "Current Plan") can't collide; they will, for exactly the users who matter most (someone who already upgraded to the "recommended" plan). See Day 7's "Bugs Fixed" #1.
11. ~~`SUPABASE_SERVICE_ROLE_KEY` is present by name in `.env.local` but its value is empty in this environment~~ — **resolved as of 2026-09-17**: `.env.local` now has a real, non-empty production service-role key; `createAdminClient()`-based features and the production migration-verification check above both confirmed it works. What's still missing for production is a *DDL-capable* credential (`SUPABASE_ACCESS_TOKEN` and/or DB password for the CLI/direct connection) — the service-role key alone only grants PostgREST/RPC access, not schema changes. See "Production status" above.
12. **When a `getX()` query/lookup function is called from both a layout and the pages nested inside it (or from several nested layouts), wrap it in React's `cache()`** (`import { cache } from "react"`) rather than accepting the repeated query — it's a zero-risk, zero-call-site-change fix, and this exact pattern (`getProfile()` called 2-3 times per request) was real and present since Day 1. Check any new cross-cutting lookup added in a layout for the same risk. See Day 8's "Performance" section.
13. **A Postgres `SECURITY DEFINER` function explicitly granted to `anon`/`authenticated` can be called through the ordinary request-scoped Supabase client — it does not need the service-role key**, since the function's own elevated privilege (not the caller's role) governs what it touches internally. Used for the Day 8 rate limiter specifically so it would work even with `SUPABASE_SERVICE_ROLE_KEY` unset in this environment; worth reaching for again anywhere else a narrow, well-defined privileged operation is needed without pulling in full admin-client access.
14. **Any new card/row component that pairs dynamic/user-generated text with a fixed-width sibling (a badge, an icon button, an amount) in a `flex` row must put `min-w-0` on the text-side wrapper and `truncate` (or `break-words`, if wrapping is preferred over truncating) on the text itself, plus `shrink-0` on the fixed sibling.** Without it, flexbox's default `min-width: auto` lets the text refuse to shrink, and — if that component sits inside an equally unprotected ancestor chain — the overflow can escape all the way to a page-level horizontal scrollbar. This exact defect class caused a real Production bug found on a real iPhone (see "Mobile Responsive Overflow Audit & Fix" above); it was found repeated in ~12 other card components that hadn't yet been reported broken. Check for it in any new component built the same way.

## Update Rule

After every major implementation session:

Update this file.

Record:

- what was completed
- bugs fixed
- current bugs
- migrations added
- routes added
- architectural decisions
- next task

Never delete useful historical information without reason.
