# WEALTH OS — PROJECT STATUS

Last updated: 2026-09-12

## Current Phase

Day 1 / Foundation + Money Core — **complete and fully verified** (see "Day 1 Final Closeout" below).

Day 2 / Wealth Engine — **code complete, unit-tested, and building clean, but NOT yet live-verified.** Every system (Smart Budget, Assets, Liabilities, Net Worth, Financial Goals, Emergency Fund, Safe-to-Spend, Wealth Score) is fully implemented — database migration written, RLS policies written, deterministic financial logic written and unit-tested (388 total dictionary keys in sync, 116/116 tests passing), UI built, dashboard integrated, navigation updated. **What's blocking full sign-off:** this session has no working Supabase credential capable of running DDL — `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is empty, there's no `DATABASE_URL`, and the Supabase CLI isn't linked (no `supabase/config.toml`, no CLI installed). Migration `0003_wealth_engine.sql` has **not been applied to the live project**, so: (1) RLS cannot be verified against a real database with two real users, (2) the new pages cannot be exercised end-to-end in a real browser. See "Day 2 — Wealth Engine" below for the full breakdown and exactly what to run once credentials are available. **Ready for Day 3: NO** until this is closed out.

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

Transforms the app from a transaction tracker toward a financial progress system: Smart Budget, Assets, Liabilities, Net Worth, Financial Goals, Emergency Fund, Safe-to-Spend, and Wealth Score. **Code complete and unit-tested; live-DB verification blocked on Supabase credentials** — see "Current Phase" above and "Known Limitations" below for exactly what's outstanding and why.

### Database migration

`supabase/migrations/0003_wealth_engine.sql` — written, reviewed, **not yet applied to the live project**. Adds 8 tables: `budgets`, `budget_categories`, `assets`, `liabilities`, `net_worth_snapshots`, `financial_goals`, `emergency_funds`, `wealth_scores`. Follows every convention from `0001_init.sql`: UUID PKs (`gen_random_uuid()`), `NUMERIC(18,2)` for all money, TEXT+CHECK instead of native enums, `user_id` ownership + RLS on every table, `updated_at` via the existing `set_updated_at()` trigger, indexes on every foreign key and common filter column. Notable constraints: `budgets` has `unique(user_id, month)` (prevents duplicate/conflicting monthly budgets); `net_worth_snapshots` has `unique(user_id, snapshot_date)` (idempotent daily snapshots); `emergency_funds` has `unique(user_id)` (one tracker per user) plus a CHECK requiring either `target_months` or `custom_target_amount`. **To apply:** `node _migrate.mjs <management-api-token>` (temporary script, reads the migration file and POSTs it to the Supabase Management API — same mechanism used earlier this project) — or run it through the Supabase SQL editor / `supabase db push` directly. This script and `_rls_test.mjs` (see RLS below) will be deleted before this task is considered fully closed; if you're reading this and they still exist, that's the tell that migration/RLS verification is still pending.

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

`src/lib/financial/wealth-score.ts` — 7 deterministic component functions (Cash Flow Health 20%, Savings Rate 15%, Emergency Fund 15%, Debt Health 15%, Net Worth Growth 15%, Income Growth 10%, Goal Progress 10%), no LLM anywhere. Every mapping is documented inline with its exact assumption (e.g. cash-flow-to-income ratio of 0 = neutral score 50, +100% = 100, -100% = 0; a 20%+ savings rate is full marks). **Missing-history fairness** (explicit task requirement): Net Worth Growth and Income Growth return a neutral 50 with `hasHistory: false` when there's no prior snapshot/month to compare against, instead of penalizing a brand-new user — surfaced in the UI as "some scores are neutral placeholders until there's enough history." `getWealthScoreImprovementActions()` returns structured, measurable actions (increase emergency fund by ฿X, reduce discretionary spending by ฿X, improve savings rate to 20%, contribute ฿X/month to the most-behind goal, reduce debt payments) rather than generic advice — each one only fires when its component scores below 90 and the underlying gap is actually real and non-zero (e.g. no "reduce spending" suggestion when cash flow is already positive). `calculation_version` is stored (currently `1`) per the task's schema requirement. Computed fresh on every dashboard load (so the number is always current) but persisted to the `wealth_scores` history table **at most once per calendar day** (`ensureTodaysWealthScore()`) — otherwise every dashboard reload would insert a duplicate row into an append-only history table. Surfaced as an expandable dashboard card (component breakdown + improvement actions) — same "no pointless standalone route" reasoning as Safe-to-Spend.

### Dashboard

New `WealthOverview` section (`src/features/dashboard/components/wealth-overview.tsx`) between the page header and the existing income/expense/cash-flow/savings-rate cards: Wealth Score, Net Worth, Safe-to-Spend, Budget status, Emergency Fund, Top Goal — 6 compact linked cards in a `grid-cols-2 lg:grid-cols-3` layout (Wealth Score and Safe-to-Spend span the full width on mobile since they're expandable; the other four pair up). Monthly Cash Flow was already on the dashboard from Day 1 (`SummaryCards`) — reused rather than duplicated. Deliberately **not** a wall of charts: every card is a number + one line of context, with detail one tap away on its own page (except Safe-to-Spend/Wealth Score, which expand in place — see above). Illustrations (`IllustrationFrame`, `BudgetIllustration`, `GoalIllustration`, `FinancialStageProgress`) were considered but not forced into these compact tiles — they're sized for full empty-state moments, not dense stat grids; each new page's own empty state does use the matching illustration (`BudgetIllustration` on `/money/budget`, `GoalIllustration` on `/plan/goals`, etc).

**Resilience fix found and applied during this session's own QA** (not a hypothetical): the very first thing `WealthOverview` did was query all 8 new tables directly. Verified live (test account, real browser) that — because migration 0003 isn't applied yet — this made the **existing, previously-working Day 1 dashboard return a hard 500** for any user with at least one account (a zero-data user never hit the code path, which is why this wasn't obvious from a quick glance). No `error.tsx` exists anywhere in the app, so an uncaught Server Component error takes down the whole page. Fixed by wrapping `WealthOverview`'s data loading in a try/catch (`loadWealthOverviewData()`) that logs the real error server-side and renders nothing if it fails, rather than crashing the page — re-verified live afterward: the dashboard now renders fully and correctly (all Day 1 content intact) even with none of the Day 2 tables present. This is a **deployment-order safeguard, not a permanent design choice** — once migration 0003 is applied, `WealthOverview` renders normally with no code changes needed. The dedicated new pages (`/money/budget`, `/money/assets`, etc.) were *not* given the same defensive wrapping — a brand-new page erroring because its own required table doesn't exist yet is expected and acceptable (the same would be true of `/money/accounts` without the `accounts` table); the fix only mattered for a *shared, previously-working* page.

### Navigation

`src/config/features.ts`: `plan: true` (was `false`) — Plan is a real, working surface now (Goals, Emergency Fund), so it's no longer hidden. `MoneyTabs` (`src/components/layout/money-tabs.tsx`) extended from 2 tabs to 6 (Transactions, Accounts, Budget, Assets, Liabilities, Net Worth), wrapped in a horizontal-scroll container (`overflow-x-auto`) so it doesn't overflow at 375px. New `PlanTabs` (`src/components/layout/plan-tabs.tsx`) + `src/app/(app)/plan/layout.tsx`, mirroring the existing Money layout pattern exactly (localized header via `getDictionary`, tabs, children). `/plan` redirects to `/plan/goals` (same pattern as `/money` → `/money/transactions`).

### Tests

6 new test files, 88 new tests (116 total, up from 28 at the end of Day 1), all passing: `tests/budget.test.ts`, `tests/net-worth.test.ts`, `tests/goals.test.ts`, `tests/emergency-fund.test.ts`, `tests/safe-to-spend.test.ts`, `tests/wealth-score.test.ts`. Every domain function in `src/lib/financial/{budget,net-worth,goals,emergency-fund,safe-to-spend,wealth-score}.ts` is covered, including every edge case the task spec named: zero income, zero expenses, negative cash flow, no assets, no liabilities, liabilities > assets, no net worth history, goal date passed, target already achieved, no emergency fund, debt-heavy user, monthly budget = 0, overspent category, missing optional fields (nullable target_months/target_date/etc handled via `null`-safe function signatures throughout, not just at the DB layer). These are pure-function tests with zero database dependency, so they're the one part of Day 2 that's **genuinely, fully verified** regardless of the migration/credentials situation.

### RLS Verification — NOT YET RUN (blocked)

`_rls_test.mjs` (temporary script, repo root) is written and ready: creates two disposable real users via the Auth REST API, then for every new table has User A create a row and verifies User B cannot SELECT it, UPDATE it, DELETE it, or INSERT a row claiming User A's `user_id`. Covers all 8 new tables including the `budget_categories` join-table pattern (ownership via the parent `budgets` row, same approach as Day 1's `transaction_tags`). **Cannot run until migration 0003 is applied** (the tables don't exist yet). Run with: `node _rls_test.mjs <supabase-url> <anon-key>` once that's done.

### Browser QA — NOT YET RUN (blocked)

Confirmed live (see "Resilience fix" above) that the dashboard itself is safe today. The 6 new dedicated pages have **not** been visually QA'd at 375/390/430/desktop, because every one of them queries a table that doesn't exist yet and will show Next.js's default error page until migration 0003 is applied — attempting screenshots now would only demonstrate the expected "table doesn't exist" failure, not real UI/UX issues. Once the migration is live, re-run the same Playwright pattern used for Day 1 (temporary install, disposable test account, screenshots at 4 widths, visual inspection for raw IDs/enum values, Thai/English mismatches, overflow, broken empty states) across all 6 new pages plus the dashboard's new `WealthOverview` cards.

### Known Limitations

1. **Migration 0003 not applied to the live project** — no usable Supabase credential this session (`SUPABASE_SERVICE_ROLE_KEY` empty, no `DATABASE_URL`, no linked CLI). This is the root cause of every item below. Apply via `node _migrate.mjs <token>` (Supabase Management API personal access token) or through the SQL editor / `supabase db push`.
2. **RLS not verified live** — script ready (`_rls_test.mjs`), blocked on #1.
3. **New pages not browser-QA'd** — blocked on #1; the shared dashboard *was* verified live and is confirmed safe either way (see "Resilience fix" above).
4. **`_migrate.mjs` and `_rls_test.mjs` are still in the repo root** — temporary, to be deleted the moment migration + RLS verification are done. Their presence is itself a signal that this work isn't finished.
5. Safe-to-Spend and Wealth Score have no standalone route — by design (see their sections above), but revisit if product feedback wants a dedicated deep-dive page later.
6. Budget's "upcoming bills" vs. "mandatory commitments" split (fixed-essential vs. variable-essential categories) is a reasonable but opinionated modeling choice for Safe-to-Spend, not something the task spec dictated precisely — documented in `src/features/safe-to-spend/queries.ts`.
7. Net worth history chart needs at least 2 daily snapshots to render (by design — shows an explicit "not enough history yet" state below that) — will naturally fill in over the following days once live.

## Next Task

**Apply `supabase/migrations/0003_wealth_engine.sql` to the live project**, then run `node _rls_test.mjs <url> <anon-key>` and a full Day 2 browser QA pass (375/390/430/desktop across all 6 new pages + dashboard), fix anything real either surfaces, delete `_migrate.mjs`/`_rls_test.mjs`, and re-confirm lint/typecheck/tests/build one more time. Only after that is Day 2 genuinely, fully done and Day 3 can start.

Carried-forward, non-blocking items from Day 1:
1. Re-check `package.json`'s `vite` override occasionally — it's pinned to unblock this sandbox's native-binding restriction, not a permanent design decision; drop it if a future vitest/vite release fixes the underlying WASM fallback.
2. **When adding any new `<Select>`, always give `SelectValue` an explicit label-resolving `children` function** — don't rely on automatic value→label matching; see the bug fixed two sessions ago.
3. `onboarding-form.tsx` and a few other secondary forms (e.g. `profile-form.tsx` labels beyond what was already fixed) may still carry hardcoded English strings outside the `/money/accounts` and `/money/transactions` scope the Day 1 closeout pass targeted.

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
