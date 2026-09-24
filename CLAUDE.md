@AGENTS.md

# WEALTH OS — PROJECT MEMORY

## Project

Name: WEALTH OS

WEALTH OS is a personal financial operating system designed to help users:

1. Understand where their money goes
2. Control spending
3. Build savings
4. Manage debt
5. Increase income
6. Build net worth
7. Create annual financial plans
8. Receive personalized financial actions from AI

Core philosophy:

Track → Analyze → Plan → Earn → Grow

The product must NOT become only an expense tracker.

The long-term goal is to answer:

"What is the next best financial action for this user?"

---

# CORE PRODUCT POSITIONING

Tagline:

Know your money. Grow your income. Build your wealth.

Thai concept:

ระบบการเงินส่วนบุคคลที่ช่วยให้ผู้ใช้รู้สถานะทางการเงิน
ควบคุมเงิน วางแผน เพิ่มรายได้ และสร้างความมั่งคั่ง

Important:

Never promise that users will become rich.

Never guarantee financial or investment returns.

---

# TARGET MARKET

Initial market:

Thailand

Primary language:

Thai

Secondary language:

English

Default currency:

THB

Default timezone:

Asia/Bangkok

Architecture must support international expansion later.

---

# PRODUCT NAVIGATION

Primary navigation:

Home
Money
Plan
Earn
AI

Do not expose every feature as separate top-level navigation.

---

# PRODUCT SYSTEMS

WEALTH OS architecture must support:

1. Accounts
2. Income / Expense Transactions
3. Smart Budget
4. Safe-to-Spend
5. Net Worth
6. Wealth Score
7. Financial Life Stage
8. Goals
9. Money Year
10. Financial Forecast
11. AI Money Coach
12. Financial Health Check
13. Subscription Detector
14. Debt Planner
15. Emergency Fund
16. Income Engine
17. Side Hustle Finder
18. Income / Wealth Missions

Additional supporting systems:

Notifications
Gamification
Wealth XP
Recurring Transactions
Upcoming Bills
Financial Alerts
Next Best Action Engine
Subscription Plans
Analytics
Feature Flags

---

# CORE DIFFERENTIATOR

Most financial applications focus on:

Expense tracking.

WEALTH OS must focus on:

Financial progress.

The major differentiator is:

EARN

The app should help users increase income, not only reduce spending.

---

# EARN SYSTEM

Users provide:

Occupation
Income
Skills
Experience
Available time
Languages
Equipment
Vehicle availability
Online/offline preferences
Target extra income

System calculates:

Current Income

Target Income

Income Gap

Then suggests realistic income opportunities.

Example:

Current Income:
฿35,000/month

Target:
฿50,000/month

Income Gap:
฿15,000/month

The system then generates actionable Income Missions.

Example:

Create portfolio
Create service offer
Find 10 leads
Contact 3 prospects
Follow up
Send quotation

Avoid vague missions such as:

"Work harder."

---

# MONEY YEAR

The application must support annual financial planning.

Structure:

Year
→ Quarter
→ Month
→ Week / Missions

Example:

Starting Net Worth
Target Net Worth
Annual Income Target
Savings Target
Investment Target
Debt Repayment Target
Side Income Target
Major Purchases

Historical annual plans must not be overwritten.

Use versioning.

---

# FINANCIAL DATA RULE

Structured database data is the source of truth.

AI MUST NOT invent:

Balances
Transactions
Income
Expenses
Debt
Net Worth
Budget
Goal progress

AI should use controlled financial tools.

---

# AI ARCHITECTURE

AI must never directly generate arbitrary SQL.

Use controlled functions such as:

getFinancialSummary()

getAccountBalances()

getTransactions()

getIncomeSummary()

getExpenseSummary()

getBudgetStatus()

getNetWorth()

getGoals()

getEmergencyFund()

getDebtSummary()

getIncomeProfile()

getMoneyYear()

runForecast()

getWealthScore()

getAvailableMissions()

AI should fetch current structured financial data before answering financial questions.

---

# FINANCIAL LOGIC

Financial calculations must be deterministic.

Do NOT use an LLM for calculations such as:

Net Worth

Safe-to-Spend

Debt payoff

Savings Rate

Wealth Score

Goal contribution

Forecast calculations

Income Gap

Create testable domain functions.

---

# NET WORTH

Formula:

Net Worth = Assets - Liabilities

Net Worth is one of the primary product KPIs.

---

# CREDIT CARD ACCOUNT SEMANTICS

Verified against the real schema and code (2026-09 audit) — not assumed.
There are two distinct, both-legitimate ways to represent a credit card,
and they serve different jobs:

**`liabilities` (`liability_type = 'credit_card'`) is the canonical debt
record.** `balance` is always ≥ 0 (a plain "amount owed"). This is the ONLY
source every debt-aware calculation reads from: Debt Health (Wealth
Score), the Priority Engine's `high_interest_debt`, `minimum_payment` /
`interest_rate` / `due_date` tracking. `accounts.account_type =
'credit_card'` is never read by any of these — confirmed by inspecting
`priority-engine.ts`, `life-stage/queries.ts`, and the Wealth Score
calculation.

**`accounts` (`account_type = 'credit_card'`) is an optional transactable
ledger for day-to-day spending through the card**, not a debt tracker. Its
balance uses the exact same uniform, signed ledger every other account
type uses (`recalc_account_balance` in `0001_init.sql`): an `expense`
transaction debits (decreases) the balance; a `transfer` where this
account is the destination credits (increases) it. This means a credit
card **account's balance is expected to go negative** as purchases
accumulate — that is correct, not a bug: `calculateNetWorth()` sums every
account's balance with its real sign, so a negative balance already
reduces Net Worth by exactly the right amount, with no special-casing.

Concretely:

- **Purchase on the card** → record an `expense` transaction against the
  credit card account. Balance moves further negative.
- **Payment toward the card** → record a `transfer` FROM a cash/bank
  account TO the credit card account. Balance moves back toward zero.
  This is the existing transfer mechanism — no new transaction type.
- **Net Worth treatment**: the account's balance (any sign) is summed
  directly into `accountAssetsCents` when `include_in_net_worth = true` —
  a negative balance correctly subtracts from Net Worth.
- **Liability treatment**: none — an `accounts` row is never read by any
  liability-aware calculation. If interest rate, minimum payment, due
  date, or Debt Health/Priority Engine visibility is wanted for a card,
  it must also (or instead) have a `liabilities` row.

---

# LIABILITY <-> ACCOUNT LINKING (credit-card double-counting fix)

Migration `0013_liability_account_linking.sql` adds
`liabilities.linked_account_id` (nullable FK → `accounts.id`), mirroring
the existing `assets.linked_account_id` pattern as closely as the domain
allows. This is how the double-counting risk described above is actually
prevented, for anyone who chooses to link — **linking is optional, never
required** (a liability with no matching account is a completely normal,
supported case).

**What linking does:**

- `calculateNetWorth()` (`src/lib/financial/net-worth.ts`) excludes a
  linked liability from `totalLiabilitiesCents` entirely — the linked
  account's (typically negative) balance already represents that same
  debt, so counting the liability too would double it.
- **Authoritative-value rule**: when linked, the ACCOUNT's ledger balance
  is what counts toward Net Worth — mirroring exactly how a linked asset's
  account is authoritative over the manual asset row. The liability's own
  `balance` field is simply excluded from the Net Worth total, whatever
  value it holds.
- **No auto-sync.** A linked liability's `balance` can legitimately differ
  from the linked account's balance (e.g. accrued interest not yet logged
  as a transaction) — this is never silently reconciled, averaged, or
  overwritten. A mismatch is a data-quality signal for the UI to surface,
  not something the system resolves on its own.
- **The Debt Engine is completely unaffected by linking.** Debt Health
  (Wealth Score), the Priority Engine's `high_interest_debt`, and
  `minimum_payment`/`interest_rate` tracking all read `liabilities` rows
  filtered only by `include_in_net_worth` — never by `linked_account_id`.
  A linked liability keeps driving these exactly as an unlinked one would;
  linking only ever changes the Net Worth total, nothing else.

**Ownership/security**: a database trigger
(`check_liability_linked_account_ownership_trg`) rejects linking to an
account that doesn't belong to the same user, re-validated at the database
level on every insert/update regardless of what the client sends (RLS
alone only scopes the `liabilities` row itself, not the account a foreign
key happens to point at — a plain FK reference is not an ownership check).

**Uniqueness**: `unique(user_id, linked_account_id) where linked_account_id
is not null` — two different liability rows can never link to the same
account, since there is no valid product reason for one physical card's
debt to be represented by two liability records simultaneously.

**Backward compatibility**: every liability row that existed before this
migration has `linked_account_id = null` — nothing was auto-linked by
guessing from name/balance/institution similarity. A user opts in
explicitly via the "Link to credit card account" field on a `credit_card`
liability, offered only against their own active `credit_card` accounts.

**Deployment status (verified 2026-09-17 with real, disposable test users
against the actual database, cleaned up afterward):** migration 0013 is
live on **staging** (`eovyvlesdgygjqrrvpas`) — confirmed: a valid
same-user link succeeds and persists; a second liability cannot link to
an already-linked account (unique-constraint rejection); a cross-user
link attempt (User A's liability → User B's real account) is rejected by
the database with the trigger's own error, and the liability's
`linked_account_id` stays `null` afterward; a linked liability, verified
by direct fetch, still carries its full `interest_rate`/`minimum_payment`
data untouched; and a linked liability's balance can be changed
independently of the linked account's balance without altering the
computed Net Worth (confirmed the account balance alone, not an average
or the liability's value, drives the total). **Applied to production**
(`lvxuruzspchhcwebrbzy`) on 2026-09-17 — see the 0012 note below for the
full deployment story (the same "0001-0011 applied but unrecorded"
history gap staging had, repaired the same way, then pushed for real).

---

# TRANSACTION IDEMPOTENCY

Migration `0012_transaction_idempotency.sql` adds
`transactions.client_request_id` (nullable uuid) plus
`unique(user_id, client_request_id) where client_request_id is not null`.

**The model**: one random UUID generated client-side per intended
submission (`transaction-form.tsx` / `transfer-form.tsx`: created once when
the form opens, resent unchanged on any retry of that same attempt,
rotated only after a successful save). Never deduplicate by transaction
*content* (amount/account/category/date) — two genuinely separate
identical transactions (two ฿80 coffees) are legitimate and must both be
saved; only a literal retry of the same request (same key) is treated as
already completed.

**On a retried key**: `createTransaction`/`createTransfer` treat the
resulting unique-constraint violation (`createTransaction`) or the RPC's
own `ON CONFLICT ... DO UPDATE ... RETURNING` (`createTransfer`, so a
transfer's atomicity — one debit, one credit, never duplicated — is
guaranteed entirely inside the database function, not by a pre-check in
application code) as a successful no-op, never a second row and never an
alarming error shown to the user.

**Backward compatible, fails safe if the migration isn't applied yet**:
`createTransaction`/`createTransfer` first try the idempotency-key path;
if that fails because the column/function-signature doesn't exist yet
(`42703`/`42883` — migration not applied to this database), they fall back
to a pre-existing content-based time-window heuristic
(`findRecentDuplicateTransaction`) rather than breaking every transaction
save. That heuristic is a bridge, not the design — see its own doc comment
in `src/features/transactions/actions.ts` for its known limitations, and
remove it once migration 0012 is confirmed applied everywhere this app runs.

**Status update (2026-09-25, doc-accuracy correction):** this has already
happened — `findRecentDuplicateTransaction` and its two `42703`/`42883`
fallback branches were removed from `src/features/transactions/actions.ts`
once migration 0012 was confirmed applied to production (see "Deployment
status" below). A fresh grep confirms zero references anywhere in `src/`.
The paragraph above is kept as historical design context (why the bridge
existed, what it protected against), not a description of the current
code.

**Deployment status (verified 2026-09-17, not assumed):** migration 0012
is live and verified on **staging** (`eovyvlesdgygjqrrvpas`) — confirmed
against the real database: same-key retry produces exactly one row,
concurrent same-key requests produce exactly one row, different keys with
identical content both save, and a retried transfer moves each account's
balance exactly once (never twice). Migration 0012 is now **applied to
production** (`lvxuruzspchhcwebrbzy`, what this app's own `.env.local`
actually points at) as of 2026-09-17.

**Deployment story, in order (2026-09-17, all same day):**
1. `.env.local` was found to have a real, non-empty production
   `SUPABASE_SERVICE_ROLE_KEY` (previously empty). Used it to run a
   live, read-only PostgREST check directly against production — both
   new columns returned `42703 column ... does not exist`, confirming
   production was genuinely unmigrated, not just undocumented.
2. This session had no DDL-capable credential (no `SUPABASE_ACCESS_TOKEN`,
   no DB password) — two access tokens tried were scoped to the wrong
   project or to a restricted/legacy permission set (the harness's own
   safety classifier also blocks a running-agent session from directly
   pushing schema changes to production via its own tool calls,
   independent of token scope — a deliberate guardrail, not worked
   around). The user generated a new, properly-scoped Access Token via
   Supabase's newer scoped-token flow (Project-scoped to `App wealth os`
   only, `Full access` preset, 7-day expiry) and ran the CLI steps
   directly in their own terminal instead.
3. `supabase migration list --linked` against production showed the
   identical "every migration since 0001 unrecorded in CLI bookkeeping"
   gap staging had (see the section below) — repaired via
   `supabase migration repair --status applied 0001 ... 0011 --linked`
   (bookkeeping only, no SQL re-executed).
4. `supabase db push --linked --dry-run` confirmed **exactly** `0012` and
   `0013` as pending, nothing else — matching the read-only check from
   step 1 exactly, so the push was known-safe before running for real.
5. `supabase db push --linked` (no `--dry-run`) applied both migrations.
6. Independently re-verified via the same read-only PostgREST check as
   step 1 (not by trusting the CLI's own success message): both
   `transactions.client_request_id` and `liabilities.linked_account_id`
   now return successfully — confirmed present.

**The heuristic fallback in `src/features/transactions/actions.ts` has
since been removed** (2026-09-25, production-hardening pass) — it was
safe to remove once production was confirmed migrated, and a later
session did so; `PROJECT_STATUS.md` reflects this as done, not a "Next
Task" anymore. The production-scoped access token used for the push
should be **deleted**
from the Supabase dashboard (Account → Access Tokens) once this work is
confirmed done, since it was a broad, short-lived, single-purpose grant.

**Known overload artifact (documented, not a bug):** `create or replace
function` does not replace a function whose parameter list changed — it
adds a new overload. After 0012, `public.create_transfer` exists in TWO
forms on any database it's applied to: the original 6-parameter version
(0001) and the new 7-parameter version with `p_client_request_id` (0012).
Every current caller (`transactions/actions.ts`'s primary path,
`recurring/actions.ts`) explicitly passes `p_client_request_id` (even as
`null`), so they always resolve to the new, idempotency-aware overload —
the old one is verified dormant, not silently in use. Only
`transactions/actions.ts`'s own pre-migration fallback branch deliberately
omits the parameter (by design, to detect an unmigrated database — since
removed, see the status note above). Dropping the old overload was
considered and intentionally deferred at the time — out of that pass's
scope. **Update (2026-09-25):** migration `0020_drop_dormant_create_
transfer_overload.sql` now does this — written, not yet applied to any
database from that session; needs `supabase db push`.

---

# WEALTH SCORE

Score:

0–100

Initial model:

Cash Flow Health: 20%

Savings Rate: 15%

Emergency Fund: 15%

Debt Health: 15%

Net Worth Growth: 15%

Income Growth: 10%

Goal Progress: 10%

Wealth Score must be deterministic.

Store calculation version.

---

# NEXT BEST ACTION ENGINE

Long-term product objective:

Turn financial information into action.

Priority examples:

1. Overdue financial obligation
2. Negative cash flow
3. Emergency Fund
4. High-interest debt
5. Financial goals
6. Income gap
7. Investing
8. Expense optimization

Example:

Next Best Action:

เติม Emergency Fund ฿2,000

Reason:

เงินสำรองเหลือประมาณ 1.6 เดือน

---

# TECH STACK

Frontend:

Next.js
React
TypeScript

UI:

Tailwind CSS
shadcn/ui

Backend:

Next.js Server Actions / Route Handlers

Database:

PostgreSQL

Infrastructure:

Supabase

Authentication:

Supabase Auth

Deployment:

Vercel

Validation:

Zod

Charts:

Recharts

Forms:

React Hook Form where appropriate

Testing:

Vitest or existing project testing stack

Future mobile:

React Native + Expo

---

# DATABASE RULES

Use UUID primary keys.

Use created_at.

Use updated_at.

Money must NOT use floating-point database types.

Prefer:

NUMERIC(18,2)

Financial tables must include user ownership.

RLS is mandatory.

---

# SECURITY

Financial data is sensitive.

Never:

Expose service role key to browser

Trust user_id sent by client

Disable RLS to solve errors

Commit secrets

Log sensitive financial data unnecessarily

Allow one user to access another user's data

Use arbitrary AI-generated SQL

All financial write operations must validate authentication and ownership.

---

# SUPABASE

Environment variables:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

Service role key is SERVER ONLY.

Never use NEXT_PUBLIC_ for secret keys.

Database migrations must live in:

supabase/migrations/

Schema changes must be reproducible through migrations.

---

# AUTH

Current architecture:

Supabase Auth

Support:

Email/password

Google OAuth architecture

Future Apple Sign-In

Important:

Signup flow must correctly handle:

successful signup
email confirmation
session creation
profile creation
duplicate email
invalid credentials

Do not convert every auth problem into generic:
"Something went wrong."

---

# UI / UX

Mobile-first. Target widths: 375px, 390px, 430px. Desktop responsive.
Thai text must display correctly at every width (see `UX_GUIDELINES.md`
principle on Thai-first layout).

**Visual style, tone, and UX behavior are owned elsewhere, not duplicated
here**: see `UX_GUIDELINES.md` for how the product should behave and
communicate (hierarchy, tone, decision load, coaching language), and
`GRAPHICS_PLAN.md` for how it should look (color, motion, icon/
illustration rules, "avoid gambling/crypto casino visual style" and
similar visual constraints).

---

# APPLICATION ROUTES

Expected architecture includes:

/
login
signup
onboarding

dashboard

money
money/transactions
money/accounts
money/budget
money/net-worth
money/subscriptions

plan
plan/goals
plan/money-year
plan/emergency-fund
plan/debt
plan/forecast

earn
earn/income
earn/skills
earn/opportunities
earn/missions

ai

notifications

settings
settings/profile
settings/security
settings/preferences
settings/billing

---

# CURRENT DEVELOPMENT PHASE

The project is being built incrementally.

Phase 0:
Foundation

Phase 1:
Money

Phase 2:
Wealth Engine

Phase 3:
Financial Planning

Phase 4:
AI Money Coach

Phase 5:
Income Engine

Phase 6:
Engagement

Phase 7:
SaaS / Billing

Phase 8:
Production Hardening

Do NOT rebuild the project from scratch when starting a new phase.

Always inspect and extend the existing codebase.

---

# DEVELOPMENT RULE

Before implementing any new task:

1. Read CLAUDE.md
2. Read PROJECT_STATUS.md
3. Inspect existing code
4. Inspect git status
5. Understand existing architecture
6. Preserve working functionality

For any UI/UX-facing work at all — a new screen, a layout change, a new
card/CTA, copy, empty/error states — read `UX_GUIDELINES.md` FIRST. It is
the highest-priority governing document for how WEALTH OS behaves and
communicates; where it conflicts with anything else (including a literal
feature request, or `GRAPHICS_PLAN.md`'s visual preferences), it wins.

For visual/graphics specifics (color, motion, icon/illustration rules),
also read `GRAPHICS_PLAN.md` — subordinate to `UX_GUIDELINES.md`.

For a new feature's *why* — what user outcome it should serve — also read
`PRODUCT_OUTCOMES.md`.

Then implement.

---

# DOCUMENT OWNERSHIP (canonical — the only copy of this table)

WEALTH OS's documentation follows **one type of truth = one owner**. Every
other doc in this project links back to this table instead of keeping its
own copy — if you find a second copy of this list anywhere, that's drift;
delete the second copy and point it here instead.

| Document | Owns | Answers |
|---|---|---|
| **`CLAUDE.md`** / **`AGENTS.md`** (this file) | Product identity, technical architecture, financial systems, business/domain rules (incl. "never guarantee returns"), security, dev rules, system boundaries, navigation architecture, source-of-truth data rules, document ownership itself | "What are we building and how does the system fundamentally work?" |
| **`PRODUCT_OUTCOMES.md`** | Product North Star, desired user outcomes, success metrics, useful retention, engagement ethics, healthy gamification, outcome hierarchy | "How do we know WEALTH OS is actually helping the user?" |
| **`UX_GUIDELINES.md`** | Information hierarchy, decision load, user flows, card behavior, progressive disclosure, CTA hierarchy, onboarding principles, forms, empty/error states, microcopy, coaching tone, personalization, accessibility behavior — **highest-priority document for UX behavior/structure** | "How should the user experience the product?" |
| **`GRAPHICS_PLAN.md`** | Visual style, brand identity, color system, typography, icon/illustration system, shapes, motion, visual asset specs — subordinate to `UX_GUIDELINES.md` when the two pull in different directions | "What should it look and feel like?" |
| **`PROJECT_STATUS.md`** | Current implementation status, completed/incomplete features, migrations, verified behavior, known limitations, QA/test status — **the only implementation-status source of truth**; `GRAPHICS_PLAN.md`'s own status markers are explicitly non-authoritative and defer here | "What actually exists right now?" |
| **`README.md`** | Setup, installation, local dev, environment setup, run/test/deploy commands | "How do I run and deploy this?" |

**Precedence when two documents discuss the same area**: the designated
owner above wins — this is domain ownership, not a single universal
ranking. A visual-style question is `GRAPHICS_PLAN.md`'s call even though
`UX_GUIDELINES.md` outranks it on *behavior*; an implementation-status
question is always `PROJECT_STATUS.md`'s call regardless of what any other
doc (especially `GRAPHICS_PLAN.md`) seems to imply.

---

# NEVER DO THIS

Never:

Reinitialize the project unnecessarily

Delete working features

Replace architecture without reason

Create duplicate modules

Hard-code user IDs

Hard-code secrets

Use fake financial data for real users

Create fake successful integrations

Add dead buttons

Disable tests to pass builds

Disable TypeScript errors

Disable RLS

Use excessive `any`

Claim a feature works without testing it

---

# DEFINITION OF DONE

A feature is not finished just because the UI exists.

A feature should have:

Working UI

Database persistence

Validation

Authorization

RLS where appropriate

Loading state

Empty state

Error state

Responsive mobile layout

Tests for critical logic

Successful typecheck

Successful lint

Successful production build

---

# QUALITY CHECK

After major work run:

npm run lint

npm run typecheck

npm test

npm run build

If typecheck script does not exist:

npx tsc --noEmit

Fix critical failures before declaring completion.

---

# WORKING STYLE

You are authorized to make reasonable engineering decisions.

Do not repeatedly ask the user trivial technical questions.

If information is missing:

choose the safest maintainable approach.

Document assumptions.

Continue implementation.

However:

Never perform destructive actions involving production data, credentials,
billing, external accounts, or irreversible operations without explicit approval.

---

# IMPORTANT: PROJECT CONTINUITY

This project will be developed over many sessions.

Never assume a new request means starting a new project.

Unless explicitly told otherwise:

ALL future WEALTH OS requests refer to this existing codebase.

Before making changes:

inspect what already exists.

Build on top of it.

Do not recreate completed functionality.

---

# END PROJECT MEMORY
