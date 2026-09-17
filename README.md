# Wealth OS

A personal financial operating system — Track → Analyze → Plan → Earn →
Grow — Thai-first, mobile-first, built on Next.js and Supabase.

**This file covers setup, local development, and deployment only.** For
what's actually implemented right now, current build status, known
limitations, and next steps, see `PROJECT_STATUS.md` — that file is the
only implementation-status source of truth (see `CLAUDE.md`'s "Document
Ownership" section for the full map of which doc owns what).

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
| `SUPABASE_SERVICE_ROLE_KEY` | **No — server only** | Supabase project → Settings → API. Required for billing (checkout customer bootstrap, webhook writes) — see below |
| `AI_API_KEY` / `AI_MODEL` | **No — server only** | AI Money Coach (Anthropic). Optional — the chat UI shows a clean "not configured" state without it |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_PLUS` / `STRIPE_PRICE_ID_PRO` | **No — server only** | Billing (Stripe). Optional in development; if any one is set in production, all four must be, and `SUPABASE_SERVICE_ROLE_KEY` becomes required too — `src/config/env.ts` throws a clear error otherwise |

`src/config/env.ts` validates these with Zod at startup and fails with a
clear error message (naming the missing variable) rather than an obscure
runtime crash. Server-only variables are never prefixed with `NEXT_PUBLIC_`,
and `src/lib/supabase/admin.ts` additionally guards itself with the
`server-only` package so an accidental client-side import fails at build
time, not silently at runtime.

Run `npm run check:env` against a loaded environment (e.g. after
`vercel env pull`) to see which variables are present by name only — it
never prints a value.

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

This applies every file in `supabase/migrations/`, in filename order (each
migration's own header comment explains what it adds — see that directory
for the current list rather than relying on a count here, since new
migrations are added as features ship; `PROJECT_STATUS.md`'s "Migrations
Added" section tracks what each one was for).

For local development, `supabase start` (or `supabase db reset`) applies
all migrations and then runs `supabase/seed.sql` automatically.

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
   settings — `SUPABASE_SERVICE_ROLE_KEY`, `AI_*`, and `STRIPE_*` as
   server-only secrets, the `NEXT_PUBLIC_*` ones as build-and-runtime
   variables. Run `npm run check:env` against the pulled environment first.
4. Point `NEXT_PUBLIC_APP_URL` at your production URL, and add
   `<production-url>/auth/callback` as a redirect URL in Supabase
   Authentication → URL Configuration.
5. Run the migrations against your production Supabase project
   (`supabase db push`) — **do not** run `supabase/seed.sql` against
   production.
6. If enabling billing: create the Plus/Pro products and prices in the
   Stripe Dashboard (test mode first), set `STRIPE_PRICE_ID_PLUS`/
   `STRIPE_PRICE_ID_PRO` to those price ids, add a webhook endpoint at
   `<production-url>/api/billing/webhook` subscribed to at least
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`, and `invoice.payment_succeeded`, and set
   `STRIPE_WEBHOOK_SECRET` to that endpoint's signing secret. Switching from
   Stripe test mode to live mode later is just swapping all four `STRIPE_*`
   values for their live-mode equivalents and updating the webhook endpoint
   to point at the live-mode secret — no code change.
7. Smoke-test the deployed URL with a disposable account before directing
   real users at it — see PROJECT_STATUS.md's "Launch Readiness" checklist.

## Folder structure

The shape below is the pattern every feature follows — it's deliberately
described as a pattern, not an exhaustive current list, since the exact
set of `src/features/*` domains grows as the product does (see
`PROJECT_STATUS.md` for what's currently implemented):

```
src/
  app/                    Routes (App Router)
    (auth)/               Public auth pages: login, signup, forgot/reset password
    (app)/                Protected shell: dashboard, money/*, plan/*, earn/*, ai, profile, billing
    auth/callback/        OAuth + email-confirmation callback route handler
    onboarding/           Onboarding (outside the app shell, own layout)
  components/
    ui/                   shadcn/ui primitives (Base UI-backed)
    layout/               Sidebar, bottom nav, header, nav/tab config
    shared/                Cross-feature UI (empty states, ...)
    illustrations/         Flat SVG illustration components (see GRAPHICS_PLAN.md)
  features/<domain>/       One folder per product domain (accounts, transactions,
                            budget, goals, income-sources, ai, billing, engagement, ...) —
                            each with queries.ts (reads), actions.ts (Server Action writes),
                            and components/
  lib/
    supabase/             Browser / server / admin Supabase clients + middleware session refresh
    validation/            Zod schemas
    financial/             Pure, deterministic calculation functions (see CLAUDE.md's "Financial Logic")
    as-trigger.ts          Base UI render-prop trigger helper
    utils.ts               cn() class merging
  types/database.ts        Hand-written schema types (see note in the file)
  config/                  Validated env access, feature flags
  i18n/                    th/en dictionaries, server locale resolution, client provider/hook
supabase/
  migrations/               See that directory for the current, authoritative list
  seed.sql                  Local-dev-only demo data
tests/                      Vitest unit tests
```

## Row Level Security overview

RLS is mandatory on every table (see `CLAUDE.md`'s "Database Rules") — the
general shape: user-owned tables are scoped to `user_id = auth.uid()`,
shared read-only reference data (like system categories) is readable by
any authenticated user but not writable by them, and write policies verify
every foreign key a client submits actually belongs to the caller rather
than trusting `user_id` from the request. Application code never trusts
ownership from the client; see `src/features/*/actions.ts`.

Each migration documents its own tables' policies and reasoning inline —
see `supabase/migrations/`. For current verified cross-user-isolation test
results (which tables, how many checks, when last verified), see
`PROJECT_STATUS.md` rather than this file, since that verification is
implementation-status, not setup documentation.

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
  structurally impossible at the cost of a cheap aggregate query per write.
- **Refund handling**: a refund is treated as an *expense reversal* —
  `calculateExpenses()` nets refunds against gross expenses — rather than as
  income. This keeps `Cash Flow = Income − Expenses` true by construction.
  See the doc comment on `calculateExpenses` in
  `src/lib/financial/calculations.ts`.
- **Savings Rate** = `(Income − Expenses) / Income × 100`, returning `0`
  (not `NaN`/`Infinity`) when income is `0`. This is a cash-flow proxy, not
  a measure of money actually set aside.
- **Categories use `TEXT + CHECK`, not native Postgres enums** — easier to
  extend later (`ALTER TABLE ... ADD CONSTRAINT`) than `ALTER TYPE ... ADD VALUE`.

## Current features, known limitations, and what's next

Tracked in `PROJECT_STATUS.md`, not here — this file is setup/run/deploy
only (see `CLAUDE.md`'s "Document Ownership" section for why). That file
has the current, verified state of every product area (auth, accounts,
transactions, budget, goals, net worth, AI coach, income engine,
engagement, billing, production hardening) plus known limitations and the
recommended next task.
