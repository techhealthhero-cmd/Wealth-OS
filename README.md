# Wealth OS

A personal finance operating system for tracking accounts, transactions, and
cash flow — Thai-first, mobile-first, built on Next.js and Supabase.

This is the **Day 1 foundation**: authentication, database schema with Row
Level Security, account and transaction CRUD, correct transfer handling, and
a real dashboard driven by actual data. It is not the full product spec —
see [Known limitations](#known-limitations) and
[Next recommended phase](#next-recommended-phase).

## Tech stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui (built on [Base UI](https://base-ui.com), not Radix — see note below)
- **Database / Auth**: Supabase (Postgres, Row Level Security, Supabase Auth)
- **Validation**: Zod
- **Forms**: React Hook Form + `useActionState` Server Actions
- **Charts**: Recharts
- **Testing**: Vitest
- **Package manager**: npm (see [Package manager note](#package-manager-note))

> **shadcn/ui + Base UI note**: the version of `shadcn` used to scaffold this
> project generates components on top of `@base-ui/react` rather than Radix
> UI. Base UI has no `asChild` prop — it uses a `render={<Element />}` prop
> instead. A small helper, `src/lib/as-trigger.ts`, adapts a normal-looking
> `<Button>Label</Button>` into the `{ render, children }` shape Base UI
> trigger components expect, so most of the app code reads like the familiar
> `asChild` pattern.

## Requirements

- Node.js 20+
- A Supabase project (local via the [Supabase CLI](https://supabase.com/docs/guides/cli), or hosted)

## Installation

```bash
npm install
cp .env.example .env.local
# fill in .env.local — see Environment setup below
```

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Client-safe? | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase project → Settings → API |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` in development |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — server only** | Supabase project → Settings → API |
| `AI_API_KEY` / `AI_MODEL` | **No — server only** | Reserved for a future AI Coach feature (not implemented in Day 1) |

`src/config/env.ts` validates these with Zod at startup and fails with a
clear error message (naming the missing variable) rather than an obscure
runtime crash. Server-only variables are never prefixed with `NEXT_PUBLIC_`,
and `src/lib/supabase/admin.ts` additionally guards itself with the
`server-only` package so an accidental client-side import fails at build
time, not silently at runtime.

## Supabase setup

1. Create a Supabase project (or run one locally with `supabase start`, from
   the [Supabase CLI](https://supabase.com/docs/guides/cli)).
2. Apply the migrations (see [Migration commands](#migration-commands)).
3. Copy the project's URL and keys into `.env.local`.
4. If you want Google OAuth: enable the Google provider under
   Authentication → Providers in the Supabase dashboard, and set the
   redirect URL to `<your-app-url>/auth/callback`. The sign-in code
   (`src/features/auth/actions.ts`, `signInWithGoogle`) is already wired up —
   it just needs a configured provider to work. Until then the "Sign in with
   Google" button will redirect to `/login?error=oauth`.

### Migration commands

Using the Supabase CLI, from the project root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies, in order:

- `supabase/migrations/0001_init.sql` — all tables, indexes, RLS policies,
  the balance-maintenance triggers, the `create_transfer` RPC, and the
  `handle_new_user` profile-bootstrap trigger.
- `supabase/migrations/0002_system_categories.sql` — the shared Thai/English
  system categories every user sees.

For local development, `supabase start` (or `supabase db reset`) applies
both migrations and then runs `supabase/seed.sql` automatically.

### Seed / demo data

`supabase/seed.sql` runs automatically on `supabase db reset` /
`supabase start` against your **local** Supabase instance only — never run
it against a hosted project, since it creates a demo auth user with a
publicly-known password directly via `auth.users` (only possible against a
local Postgres you fully control).

**Demo login**: `demo@wealthos.local` / `wealthos-demo-password`

The demo user gets two accounts (Cash ฿5,000, SCB Bank ฿75,000), a month of
income/expense transactions matching the Day-1 spec example, and one
transfer between the two accounts (to exercise transfer handling end to
end).

## Development

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Testing

```bash
npm test
```

Runs the Vitest suite (`tests/`) covering the financial calculation
utilities: income/expense/cash-flow/savings-rate math, refund netting,
transfer exclusion, account balance reconstruction, currency formatting, and
edge cases (zero income, negative cash flow, large values, decimal amounts).

## Build

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build        # next build
```

All four currently pass cleanly against this codebase.

> **Windows / Turbopack note**: `npm run dev` and `npm run build` are pinned
> to `--webpack` in `package.json`. On this development machine, an
> Application Control policy blocks the native `@next/swc-win32-x64-msvc`
> binary, and Turbopack (Next 16's default) requires native bindings — only
> the WASM fallback loads, which Turbopack can't use. Webpack mode still
> uses the WASM SWC fallback for transforms and builds successfully. If your
> environment doesn't have this restriction, `next build` (Turbopack) should
> also work; feel free to drop `--webpack` there.

## How to deploy

1. Push this repository to your Git provider.
2. Deploy to Vercel (or any Next.js-compatible host).
3. Set the environment variables from `.env.example` in the host's project
   settings — `SUPABASE_SERVICE_ROLE_KEY` and `AI_*` as server-only secrets,
   the `NEXT_PUBLIC_*` ones as build-and-runtime variables.
4. Point `NEXT_PUBLIC_APP_URL` at your production URL, and add
   `<production-url>/auth/callback` as a redirect URL in Supabase
   Authentication → URL Configuration.
5. Run the migrations against your production Supabase project
   (`supabase db push`) — **do not** run `supabase/seed.sql` against
   production.

## Folder structure

```
src/
  app/                    Routes (App Router)
    (auth)/               Public auth pages: login, signup, forgot/reset password
    (app)/                Protected shell: dashboard, money/*, profile
    auth/callback/        OAuth + email-confirmation callback route handler
    onboarding/           Day-1 onboarding (outside the app shell, own layout)
  components/
    ui/                   shadcn/ui primitives (Base UI-backed)
    layout/               Sidebar, bottom nav, header, nav config
    shared/                Cross-feature UI (empty states, ...)
  features/
    auth/                 Server actions + forms for login/signup/logout/password reset
    accounts/             Queries, server actions, and components for accounts
    transactions/         Queries, server actions, and components for transactions/transfers
    categories/           Category queries (system + user categories)
    dashboard/            Dashboard data aggregation + charts + summary cards
    profile/              Profile queries/actions + onboarding form
  lib/
    supabase/             Browser / server / admin Supabase clients + middleware session refresh
    validation/           Zod schemas (account, transaction, transfer, profile, auth)
    financial/            Pure calculation functions + cents-based money math
    as-trigger.ts          Base UI render-prop trigger helper
    utils.ts               cn() class merging
  types/database.ts        Hand-written schema types (see note in the file)
  config/                  Validated env access, feature flags
  i18n/                    th/en dictionaries, server locale resolution, client provider/hook
supabase/
  migrations/               0001_init.sql, 0002_system_categories.sql
  seed.sql                  Local-dev-only demo data
tests/                      Vitest unit tests
```

## Row Level Security overview

Every table has RLS enabled. The short version:

- **profiles**: a user can only read/write their own row (`user_id = auth.uid()`).
- **accounts**, **transactions**, **tags**: fully scoped to the owning user.
- **categories**: system categories (`is_system = true`, `user_id IS NULL`)
  are readable by any authenticated user; custom categories are scoped to
  their owner, and a user can never set `is_system = true` on their own row.
- **transaction_tags**: has no `user_id` column of its own, so its policies
  check ownership via the parent `transactions` row.
- **transactions insert/update** policies additionally verify that every
  referenced `account_id` / `from_account_id` / `to_account_id` /
  `category_id` belongs to the caller (or is a system category) — this is
  the database-level backstop against a client submitting an account or
  category it doesn't own. Application code never trusts `user_id` or
  ownership from the client; see `src/features/*/actions.ts`.

Full detail, including the reasoning for each design choice, is documented
inline in `supabase/migrations/0001_init.sql`.

## Design decisions worth knowing about

- **Money is `NUMERIC(18,2)`, never floating point**, both in Postgres and
  in application code (`src/lib/financial/money.ts` does all arithmetic in
  integer cents). This avoids the classic `0.1 + 0.2 !== 0.3` class of bug
  silently corrupting balances over many transactions.
- **Transfers are a single transaction row** with `from_account_id` /
  `to_account_id` (not two linked rows), which makes transfer creation
  atomic by construction and makes it structurally impossible to
  double-count a transfer as income or an expense. See
  `create_transfer()` in the migration and `createTransfer` in
  `src/features/transactions/actions.ts`.
- **Account balances are recomputed, not incremented.** `current_balance` is
  maintained by a trigger that recalculates the full balance from
  `opening_balance` + a fresh aggregate over `transactions` on every
  relevant write, rather than nudging it up/down in place. This makes drift
  structurally impossible at the cost of a cheap aggregate query per write —
  a good trade at Day-1 scale.
- **Refund handling**: a refund is treated as an *expense reversal* —
  `calculateExpenses()` nets refunds against gross expenses — rather than as
  income. This keeps `Cash Flow = Income − Expenses` true by construction.
  See the doc comment on `calculateExpenses` in
  `src/lib/financial/calculations.ts`.
- **Savings Rate** = `(Income − Expenses) / Income × 100`, returning `0`
  (not `NaN`/`Infinity`) when income is `0`. This is a cash-flow proxy, not
  a measure of money actually set aside — see
  [Known limitations](#known-limitations).
- **Categories use `TEXT + CHECK`, not native Postgres enums** — easier to
  extend later (`ALTER TABLE ... ADD CONSTRAINT`) than `ALTER TYPE ... ADD VALUE`.

## Current features (Day 1)

- Email/password auth (Supabase Auth), with Google OAuth wired up but
  requiring provider configuration to activate.
- Protected app shell: sidebar (desktop) + bottom navigation (mobile),
  profile menu with logout.
- Accounts: create, edit, archive, with derived (never client-trusted)
  balances.
- Transactions: income/expense/refund/debt payment/savings transfer/
  investment allocation CRUD, plus dedicated, atomic transfers between
  accounts.
- Search/filter transactions by type, account, category, and free text.
- Quick Add: a floating action button (mobile) / inline button (desktop)
  for fast expense/income/transfer entry.
- Dashboard: this month's income, expenses, cash flow, savings rate,
  account balances, recent transactions, income-vs-expense and
  spending-by-category charts (Recharts, using a colorblind-safe validated
  palette) — all computed from real data, with explicit empty states
  instead of zeros or fake numbers.
- Day-1 onboarding: name, optional monthly income/expenses, optional
  starting balance (creates a starting Cash account), optional goal.
- System categories seeded in Thai + English.
- Thai-default, translation-ready UI (`src/i18n/`) — see limitations below
  for what's translated so far.

## Known limitations

- **i18n coverage is partial.** The translation infrastructure
  (`src/i18n/`: dictionaries, `getLocale`, `I18nProvider`, `useTranslation`)
  is fully wired and working — navigation, the header menu, and the
  dashboard are translated and switch with the user's `preferred_language`.
  Forms and dialogs (accounts, transactions, transfers, auth) are still
  hardcoded in English. Extending coverage is mechanical: add keys to
  `src/i18n/locales/{th,en}.json` and swap hardcoded strings for `t("...")`
  in each component.
- **Editing an existing transfer isn't supported.** Delete and recreate
  instead. (Creating, listing, filtering, and deleting transfers all work.)
- **`debt_payment` / `savings_transfer` / `investment_allocation` only debit
  the source account** — they don't model a corresponding credit to a
  liability/savings/investment account. A full double-entry ledger is out
  of scope for Day 1; see `recalc_account_balance()` in the migration for
  the exact documented behavior.
- **Savings Rate is a cash-flow proxy**, not a measure of money actually set
  aside (see Design decisions above).
- **Cross-currency transfers are rejected** by `create_transfer()` — both
  accounts must share a currency code for now.
- **Onboarding's "monthly income" and "monthly essential expenses" fields
  aren't persisted** — there's no column for them in `profiles` per the
  Day-1 schema. Only "starting balance" (creates a Cash account) and
  display name are saved. Extending this needs either new profile columns
  or a separate `financial_snapshots`-style table.
- **Google OAuth requires configuration** in the Supabase dashboard before
  it will work (see Supabase setup above); the code path is complete.
- No automated RLS policy tests (e.g. pgTAP) — RLS logic is documented
  inline and was reasoned through manually. Automated policy tests are a
  good next step.

## Next recommended phase

1. Finish i18n coverage across forms/dialogs.
2. pgTAP (or similar) tests asserting RLS policies actually block
   cross-user access, not just that they're declared.
3. A liability/investment-aware balance model, if debt/savings/investment
   tracking needs to go beyond "debit the source account."
4. The remaining nav surfaces from the full spec (Plan, Earn, AI) — each is
   feature-flagged off (`src/config/features.ts`) and hidden from
   navigation entirely until it has a real implementation, per the
   "no fake buttons" rule.
5. Recurring transactions (the `is_recurring` flag and `source = 'recurring'`
   already exist in the schema but nothing populates them yet).
