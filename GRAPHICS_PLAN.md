# WEALTH OS — GRAPHICS PLAN

**This is the single source of truth for visual direction, graphics
identity, icon rules, illustration rules, asset inventory, roadmap, status,
and priority.** It replaces `VISUAL_SYSTEM.md`, which has been retired —
nothing from it was lost; every decision in Part A originated there.

Companion docs: `CLAUDE.md` (product/engineering source of truth),
`PROJECT_STATUS.md` (current build-state source of truth), `README.md`
(setup/run/deploy). Read this file before adding any new color, icon, or
illustration.

**Status markers used throughout Part B** — verified against the actual
repository at the time of writing (2026-09-11), not against what any prior
doc claimed:

- ✅ Built + integrated — the component exists **and** is imported/rendered somewhere real
- 🟡 Component ready, not integrated — exists, but nothing in the app renders it yet
- ⬜ Not built
- 🚫 Intentionally not needed

---

# PART A — VISUAL SYSTEM RULES

## Visual style

Flat, geometric, generous whitespace. Premium fintech, modern, calm,
trustworthy, friendly, minimal, mobile-first, Thai-first.

**Do not use:**
- gradients
- glassmorphism
- skeuomorphism
- photography / realistic stock imagery
- detailed character art / childish mascots
- neon crypto styling
- casino/gambling visual language
- excessive visual noise

Illustrations are built from simple rounded shapes (circles, rounded
rectangles, soft arcs) — never detailed character art or realistic human
figures, which read as either childish or expensive stock art depending on
execution quality; neither fits "premium but not corporate."

**Reference feeling**: Wise / Revolut / Notion level of clarity and polish.
Do not copy their exact design.

## Color system

The app has one real brand color — not pure grayscale (that was the
`shadcn` default before this system existed; `src/app/globals.css` now
defines the tokens below):

| Role | Light | Dark | Used for |
|---|---|---|---|
| **Brand primary** | `#2a78d6` | `#3987e5` | Primary CTA, active navigation, links, focus rings, the brand mark |
| Chart / illustration palette | `#2a78d6` `#eb6834` `#1baf7a` `#eda100` `#e87ba4` | dark-stepped equivalents | Charts (`dataviz` skill palette), illustration accent shapes |
| Semantic success | `emerald-600` / `emerald-400` | same | Income figures, positive cash flow, success toasts |
| Semantic danger | `rose-600` / `rose-400` + `--destructive` | same | Expense figures, destructive actions |
| Neutral surfaces | existing `background`/`card`/`muted` grayscale | same | Everything else — the app should read as "calm," not "colorful" |

**The brand blue is the ONLY primary interface color.** The other four chart
hues are reserved for charts, illustrations, semantic data, and accents —
never repurposed as a second "primary," or the interface stops reading as
one coherent brand.

## Icon system

**Functional icons** (nav, buttons, form fields): `lucide-react` only.
- Do not mix icon libraries.
- Stroke width ~2.
- Consistent sizing (`h-4 w-4` to `h-6 w-6` depending on context).
- Functional icons stay simple and recognizable — never decorative.

**Decorative illustrations**: reusable SVG React components in
`src/components/illustrations/`. `viewBox="0 0 200 200"` (small brand/badge
marks may use a tighter `0 0 32 32`). ~2–3 palette colors per illustration,
flat fills only.

## Emoji rules

Emoji may be used **only** when they measurably improve scanning:
- transaction categories
- account type badges
- quick-entry interfaces

Rules: never decorative filler, never in major headings, maximum one emoji
per UI element, never replace an important text label.

## Shape language

Cards, bottom sheets, illustration containers, chips, and major UI surfaces
share one coherent radius family (`--radius` = 0.625rem, scaling up through
`--radius-2xl`/`3xl`/`4xl` in `globals.css`).

Avoid: inconsistent sharp rectangles, excessive pills everywhere, chat-app
visual language (e.g. fully circular avatars as the whole shape of a
finance-data element).

## Tone

Warm, plain-spoken, calm, supportive, practical, non-judgmental. Thai copy
should feel natural (see `src/i18n/locales/th.json` for established
politeness level). Empty states must tell the user what to do next in one
line.

Avoid: guilt ("You haven't saved anything yet 😢"), jokes in serious
financial states, childish tone, aggressive urgency.

## Motion system

150–250ms. Preferred: opacity, a subtle transform, a gentle slide, a small
scale on tap feedback (already shipped: the bottom sheet's slide-in, the
category-chip `active:scale-95`).

Avoid: bouncy/spring animations, long blocking transitions, distracting
motion, excessive confetti.

## What WEALTH OS is *not*

- a crypto dashboard
- a casino-style financial app
- a stock-photo corporate bank
- a cartoon finance app
- a mascot-first product
- a dense wall of charts on first load (see the dashboard's empty state for
  the correct alternative: one clear illustration + one action)
- gradients as a crutch for "premium"
- progress bars shaped like coins
- countdown-timer urgency patterns

---

# PART B — GRAPHICS / ASSET ROADMAP

## Brand assets

| Asset | Status | Notes |
|---|---|---|
| Main logo | ✅ | `BrandMark` (`src/components/illustrations/brand-mark.tsx`) + "Wealth OS" wordmark, used in header/sidebar/auth/landing |
| Icon-only logo | ✅ | `BrandMark` alone *is* the icon-only mark — no wordmark baked into the SVG |
| Light mode logo | ✅ | `BrandMark` uses `currentColor` + `var(--primary)`, which resolve correctly in light mode automatically — no separate asset needed |
| Dark mode logo | ✅ | Same component; `var(--primary)` resolves to the dark-mode blue token automatically |
| Favicon | ✅ | `src/app/icon.tsx` (32×32, `next/og` `ImageResponse`) — replaces the deleted default Next.js `favicon.ico`. Verified: returns a real 32×32 PNG. |
| App icon concept (PWA/home-screen) | ✅ | `src/app/apple-icon.tsx` (180×180) — verified: returns a real 180×180 PNG |
| Splash/loading mark | ⬜ | Not built |
| Alternate logo lockup (horizontal/stacked variants) | ⬜ | Not built — only the one lockup used in headers exists |
| Compact monogram | ⬜ | Not built as a distinct asset (the brand mark itself is already compact, but no dedicated single-letter/monogram variant exists) |
| Brand pattern | ⬜ | Not built |
| Background motif | ✅ | `DecorativeBlob`, now actually composed via the new `IllustrationFrame` wrapper (`illustration-frame.tsx`) — used behind every illustration on the landing page, onboarding page, and all three `EmptyState` illustrations (accounts, transactions, dashboard). Each illustration's own inline background circle was removed so there's exactly one background mechanism, not two overlapping shapes. |

## Account icon system

| Type | Status |
|---|---|
| Cash, Bank, Savings, Credit Card, E-Wallet, Investment, Other | ✅ all 7 — `ACCOUNT_TYPE_EMOJI` in `src/lib/transaction-ui.ts`, rendered in `AccountPicker` and account cards |

Confirmed: account UUIDs are never rendered — only `account.name` (+ emoji +
optional institution/balance). See `AccountPicker`'s `AccountLabel`.

## Transaction type icons

| Type | Status |
|---|---|
| Income, Expense, Transfer | ✅ — `transactionTypeVisual()` (emoji + color + text badge, never color alone) |
| Refund, Debt payment, Savings transfer, Investment allocation | ✅ — Lucide icons in `TYPE_ICONS` (`transaction-row.tsx`) |

## Category visuals

| Set | Status |
|---|---|
| Expense (Food, Transport, Housing, Shopping, Health, Entertainment, Education, Utilities, Subscription, Insurance, Family, Other) | ✅ — `CATEGORY_ICON_EMOJI` map, rendered in `CategoryPicker` chip grid |
| Income (Salary, Freelance, Business, Bonus, Commission, Interest, Cashback/Refund, Other) | ✅ — same map/mechanism |

## Transaction UX visuals

| Element | Status |
|---|---|
| Large amount entry | ✅ `AmountInput` |
| Account selector visual | ✅ `AccountPicker` |
| Category chips | ✅ `CategoryPicker` |
| Date selector (friendly "Today"/"Yesterday") | ✅ `DateField` |
| Merchant/source field (context-aware label) | ✅ built into `TransactionForm` |
| Optional notes disclosure | ✅ `CollapsibleNotes` |
| Quick Add button | ✅ `QuickAdd` (FAB + inline variant) |
| Success state | ✅ toast + `SuccessBadge` |
| Transfer distinction (never miscounted as income/expense, visually badged) | ✅ |
| Recent transaction quick-repeat cards | ✅ `QuickRepeat` — chip row on `/money/transactions`, taps prefill (never auto-submit) a normal create-mode `TransactionForm` |

## Empty states

| State | Status |
|---|---|
| No Transactions | ✅ `EmptyTransactionsIllustration` |
| No Accounts | ✅ `EmptyAccountsIllustration` |
| No Budget | ⬜ (feature not built) |
| No Goals | ⬜ (feature not built) |
| No Assets | ⬜ (feature not built) |
| No Liabilities | ⬜ (feature not built) |
| No Net Worth history | ⬜ (feature not built) |
| No Notifications | ⬜ (feature not built) |
| No AI conversations | ⬜ (feature not built) |
| No Income Plan | ⬜ (feature not built) |
| No Missions | ⬜ (feature not built) |
| No Subscriptions (billing) | ⬜ (feature not built) |
| No Money Year plan | ⬜ (feature not built) |
| No Forecast scenario | ⬜ (feature not built) |

Each built empty state already follows the required shape (illustration +
headline + one-line guidance + primary CTA) — see `EmptyState`
(`src/components/shared/empty-state.tsx`), which accepts either a Lucide
`icon` or a full `illustration` node. Future empty states should reuse this
same component rather than a bespoke layout.

## Dashboard visuals

| Element | Status |
|---|---|
| Cash Flow, Income, Expenses, Savings Rate (summary cards) | ✅ `SummaryCards`, real data |
| Income vs Expense chart, Spending by Category chart | ✅ `charts.tsx` (Recharts, validated palette) |
| Positive/negative progress coloring | ✅ (green/red tone on the above) |
| Wealth Score | ⬜ (feature not built) |
| Net Worth | ⬜ (feature not built) |
| Safe-to-Spend | ⬜ (feature not built) |
| Goal progress | ⬜ (feature not built) |
| Income Gap | ⬜ (feature not built) |
| Today's Missions | ⬜ (feature not built) |
| Financial alerts | ⬜ (feature not built) |

**Rule (unchanged going forward): data is the hero, graphics support data,
never overpower it** — this is already how the dashboard is built (charts
and numbers first; illustration only appears in the zero-data empty state).

## Status system

| State | Status |
|---|---|
| Success | ✅ `SuccessBadge`, used as the transaction-save toast icon |
| Info, Warning, Error, Loading | ✅ already wired at the toast level — `src/components/ui/sonner.tsx` configures Lucide `InfoIcon`/`TriangleAlertIcon`/`OctagonXIcon`/`Loader2Icon` per toast type (pre-existing, confirmed still in place) |
| Syncing | ⬜ not built (no offline/sync model exists) |
| Offline | ⬜ not built |
| Locked premium | 🟡 `LockedBadge` built (neutral lock mark, not a marketing gem/crown — no billing system exists to attach it to yet), not wired to any page |
| Security/privacy state | ⬜ not built |

## Onboarding illustrations

| Concept | Status |
|---|---|
| Generic welcome ("your money, growing") | ✅ `WelcomeIllustration`, used on the single-step Day-1 onboarding screen and the landing page |
| Track your money / Plan your future / Grow your income / Build your wealth (individual pillar illustrations) | ⬜ not built — current onboarding is the simplified Day-1 single-step flow, not the full multi-step onboarding from the original product spec |
| AI financial guidance | ⬜ not built |
| Annual financial planning (Money Year) | ⬜ not built |

## Goal graphics

The Goals feature itself doesn't exist yet (CLAUDE.md Phase 3), so
everything here is 🟡 ready-not-integrated or ⬜ not built — nothing is
wired to a page.

| Item | Status |
|---|---|
| Generic goal illustration | ✅ `GoalIllustration` (flag-on-a-path motif), integrated on `/plan/goals` empty state (Day 2) |
| Per-goal-type icons (Emergency Fund, Travel, Gadget, Car, Home, Education, Wedding, Business Capital, 1 Million, Retirement, Custom) | ✅ `GoalTypeIcon` + `GOAL_TYPE_EMOJI` map — one component covering all 10 types, matching the existing category-icon pattern, rather than 10 separate files. Integrated on `/plan/goals` (Day 2). Type union adjusted from a pre-Day-2 placeholder (`business`, no `million`) to match the real `financial_goals.goal_type` schema (`business_capital`, `million`) — safe in-place edit since it wasn't imported anywhere yet. |
| States: In progress, Completed, Behind target, Ahead of target | ⬜ — deferred; state visuals depend on the goal data model, which doesn't exist yet |

## Net Worth / Wealth graphics

| Item | Status |
|---|---|
| 7-stage Financial Life Stage progression (Survival → Stable → Protected → Debt Controlled → Investor → Wealth Builder → Financial Freedom) | ✅ `FinancialStageProgress` — a plain stepper, not a game-like level bar, per the "never imply guaranteed wealth" rule below. Integrated on the dashboard's Life Stage card (Day 3), driven by `calculateFinancialLifeStage()` |
| Net Worth hero, Assets, Liabilities, Net Worth growth, Wealth milestone | ⬜ not built (feature not built) |

**Standing rule for when this is built**: never visually imply guaranteed
wealth (matches CLAUDE.md's "never promise users will become rich").

## Budget / Safe-to-Spend visuals

| Item | Status |
|---|---|
| Generic budget/safe-to-spend illustration (half-gauge motif) | ✅ `BudgetIllustration`, integrated on `/money/budget` empty state (Day 2) |
| Category budget progress, overspending warning, under-budget success, Upcoming Bills, Monthly Plan progress | ⬜ not built |

## AI Coach visuals

| Item | Status |
|---|---|
| Generic AI Coach illustration (speech bubble + spark — deliberately not a robot/mascot) | ✅ `AICoachIllustration`, integrated on `/ai`'s empty chat state (Day 4) |
| AI insight card, Next Best Action card, Monthly Health Check card | ✅ built as plain Card-based layouts (status badges, labeled rows) rather than new illustration assets — matches the existing budget/goal card visual language (Day 4) |
| AI suggestion card, financial explanation motif | ⬜ not built |

Tone requirement for future work here: intelligent, calm, trustworthy —
never robotic, never childish.

## Earn / Income graphics

| Item | Status |
|---|---|
| Generic Earn illustration (ascending bars + growth arrow) | 🟡 `EarnIllustration`, not wired to any page |
| Income Dashboard hero, Income Gap card, Side Hustle Finder, Skills profile, Opportunity ranking, Income Mission, first-income milestone, freelance/client work, extra-income achievement | ⬜ |

Standing rule: motivating, never "get rich quick."

## Mission / Gamification graphics

| Item | Status |
|---|---|
| Generic completed-mission badge | 🟡 `MissionBadge` |
| Streak badge | 🟡 `StreakBadge` (flame motif) |
| Mission icon set, mission card, XP badge, level badge, other achievement badges, progress ring, completion animation | ⬜ |
| Specific achievements (first transaction, first budget, first goal, emergency fund started, first income mission, 7-day streak, net worth milestone) | ⬜ |

Standing rule: gamification must reward healthy financial behavior, not
engagement for its own sake.

## Subscription / Premium visuals

All ⬜ not built — no billing/subscription system exists yet (CLAUDE.md
Phase 7, not started): Free/Plus/Pro badges, upgrade illustration, locked
feature visual, billing success/failure, AI usage visual.

## Celebration / milestone visuals

| Item | Status |
|---|---|
| Generic celebration mark (star + a few short understated rays — no confetti) | 🟡 `CelebrationBadge` |
| Goal reached, net worth milestone, new financial stage, new level, savings streak, first extra income, annual plan completed (specific moments) | ⬜ not built |

Standing rule: tasteful celebration only — no confetti, no modal takeover
(see Part A "Tone" and "What WEALTH OS is not").

## Landing / marketing graphics

| Item | Status |
|---|---|
| Landing hero (brand mark + `WelcomeIllustration` + headline) | ✅ built + integrated |
| Track → Plan → Earn → Grow visual | ✅ a 4-step Lucide-icon strip under the hero CTAs (`src/app/page.tsx`) — functional icons, not new illustration SVGs, since a row of small step markers is the icon system's job, not the illustration system's (see Part A "Icon system") |
| Feature illustrations (per-feature marketing sections) | ⬜ not built |
| AI Coach / Earn / Financial planning feature visuals | ⬜ not built |
| Pricing visuals | ⬜ not built (no pricing page exists) |
| CTA section, footer graphic | ⬜ not built (landing page is a hero + CTAs + the pillar strip above; no footer section yet) |

## Social / promotional assets

| Item | Status |
|---|---|
| Open Graph image | ✅ `src/app/opengraph-image.tsx` (1200×630, `next/og`) — brand mark + wordmark + tagline on a flat surface with one soft accent circle. `metadataBase` is now set in `src/app/layout.tsx` (from `NEXT_PUBLIC_APP_URL`) so the generated URL resolves correctly instead of defaulting to `localhost`. Verified: returns a real 1200×630 PNG. |
| Product preview, launch announcement, feature announcement, milestone post template, app preview template | ⬜ not built |

## Current existing assets (verified, not assumed)

| Component | File | Actually used in |
|---|---|---|
| `BrandMark` | `brand-mark.tsx` | `src/app/page.tsx`, `src/app/(auth)/layout.tsx`, `src/components/layout/sidebar.tsx`, plus redrawn directly (Satori can't import React components) in `icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx` |
| `IllustrationFrame` | `illustration-frame.tsx` | `src/components/shared/empty-state.tsx`, `src/app/page.tsx`, `src/app/onboarding/page.tsx` — the wrapper that actually puts `DecorativeBlob` to use |
| `DecorativeBlob` | `decorative-blob.tsx` | via `IllustrationFrame`, everywhere above — no longer unused |
| `WelcomeIllustration` | `welcome-illustration.tsx` | `src/app/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/(app)/dashboard/page.tsx` (empty state) |
| `EmptyAccountsIllustration` | `empty-accounts-illustration.tsx` | `src/features/accounts/components/account-list.tsx` |
| `EmptyTransactionsIllustration` | `empty-transactions-illustration.tsx` | `src/features/transactions/components/transaction-list.tsx` |
| `SuccessBadge` | `success-badge.tsx` | `src/features/transactions/components/transaction-form.tsx`, `transfer-form.tsx` (toast icon) |
| `LockedBadge` | `locked-badge.tsx` | nowhere yet — 🟡, no billing system exists |
| `GoalIllustration` | `goal-illustration.tsx` | ✅ `/plan/goals` empty state (Day 2) |
| `GoalTypeIcon` | `goal-type-icon.tsx` | ✅ `/plan/goals` goal cards (Day 2) |
| `EarnIllustration` | `earn-illustration.tsx` | nowhere yet — 🟡, no `/earn` route exists |
| `AICoachIllustration` | `ai-coach-illustration.tsx` | ✅ `/ai` empty chat state (Day 4) |
| `MissionBadge` | `mission-badge.tsx` | nowhere yet — 🟡, no missions feature exists |
| `StreakBadge` | `streak-badge.tsx` | nowhere yet — 🟡, no missions feature exists |
| `CelebrationBadge` | `celebration-badge.tsx` | nowhere yet — 🟡, no goals/milestones feature exists |
| `BudgetIllustration` | `budget-illustration.tsx` | ✅ `/money/budget` empty state (Day 2) |
| `FinancialStageProgress` | `financial-stage-progress.tsx` | ✅ dashboard Life Stage card (Day 3) |

---

# BUILD PRIORITY

## Sprint 1 — Core UX (P1)
- ~~Favicon + app icon~~ — **done**: `src/app/icon.tsx` + `apple-icon.tsx`
- ~~Compose `DecorativeBlob` into a real screen~~ — **done**: via `IllustrationFrame`, now used on 5 real screens
- ~~Open Graph image + `metadataBase`~~ — **done**: `src/app/opengraph-image.tsx`
- ~~Recent transaction quick-repeat cards~~ — **done**: `QuickRepeat` (chip row + prefill-only `TransactionForm`), built in the Day 1 final closeout pass
- ~~Account icons, category icons, transaction type icons, core empty states~~ — **already done**, kept here only for traceability against the originally-requested sprint shape

## Sprint 2 — Product Polish (P2)
- ~~Dashboard visuals (Wealth Score, Net Worth, Safe-to-Spend, Goal progress)~~ — **done** (Day 2): deliberately data-first compact cards, not new illustration assets — see PROJECT_STATUS.md "Day 2 — Dashboard" for why illustrations were judged too large for a dense stat grid. Income Gap / Financial alerts still blocked (Earn/Phase 4 features don't exist yet)
- Status visuals: Syncing / Offline / Security-privacy states (Locked-premium done, see below)
- Full multi-step onboarding illustrations (Track/Plan/Earn/Grow pillars, AI guidance, Money Year) — still open; the landing page got its Track→Plan→Earn→Grow treatment (Sprint 4), but onboarding itself is still the single-step Day-1 flow
- ~~Goals: per-goal-type icons~~ — **done**: `GoalTypeIcon`, integrated on `/plan/goals` (Day 2). Schedule state (achieved/ahead/on_track/behind/unknown) is now functionally shown via a color-coded badge on each goal card — a dedicated per-state *illustration* variant is still open if that's wanted beyond a badge
- ~~Net Worth: financial-stage progression~~ — **done**: `FinancialStageProgress`, integrated on the dashboard's Life Stage card (Day 3) rather than the Net Worth page itself — the 7-stage classification is a whole-financial-picture concept (cash flow, emergency fund, debt, savings, net worth all combined), not specific to Net Worth alone; hero/assets/liabilities visuals on the Net Worth page itself still open
- ~~Budget: generic illustration~~ — **done**: `BudgetIllustration`, now integrated into `/money/budget`'s empty state (Day 2); detail visuals (category progress, overspending warning) still open — category budgets use plain progress bars, not new illustration assets

## Sprint 3 — Product Differentiators (P3)
- AI Coach: insight/suggestion cards, Ask-AI empty state, Next Best Action visual
- Earn: Income Gap card, Side Hustle Finder, Skills profile, Income Missions
- Missions/Gamification: ~~streak badge~~ **done** (`StreakBadge`); full mission-card/XP/level/progress-ring system still open
- Wealth Score, Safe-to-Spend detail visuals

## Sprint 4 — SaaS / Brand (P3)
- Premium/subscription visuals (Free/Plus/Pro, upgrade illustration, billing states) — locked-feature status mark done (`LockedBadge`), the rest still open
- Pricing page visuals
- ~~Landing page: Track→Plan→Earn→Grow~~ — **done** (icon strip on the real landing page); per-feature illustrations and a footer section still open
- ~~Celebration/milestone: generic mark~~ — **done** (`CelebrationBadge`); specific celebration moments still open
- ~~Social/promotional: Open Graph image~~ — **done**; announcement/preview templates still open

---

# TOP 9 HIGHEST-PRIORITY MISSING ASSETS

Reflects actual repository state today (all previous top-10 items are now
✅ or 🟡 — see Part B — this is a fresh list, not a carried-over one; it
dropped to 9 after recent transaction quick-repeat cards shipped):

1. **Full multi-step onboarding illustrations** (Track/Plan/Earn/Grow pillars, AI guidance, Money Year) — the current onboarding is still the simplified Day-1 single-step flow; these need that flow to grow first
2. ~~AI Coach insight/suggestion card visuals~~ — **done**: `AICoachIllustration` is now integrated on `/ai`'s empty chat state (Day 4), and Next Best Action/Monthly Health Check/Insight cards ship as plain Card-based layouts (status badges, labeled rows — same visual language as Budget/Goal cards) rather than new bespoke illustrations; a dedicated AI suggestion-card illustration motif is still open if product feedback wants one
3. **Earn feature detail visuals** (Income Gap card, Side Hustle Finder, Skills profile) — `EarnIllustration` covers the generic case; the actual Earn UI will need more
4. **Goal state variants** (in progress/completed/behind/ahead target) — blocked on the Goals data model existing; per-type icons are already done (`GoalTypeIcon`)
5. **Net Worth hero + Assets/Liabilities visuals** — the 7-stage stepper (`FinancialStageProgress`) is now live on the dashboard; the Net Worth page itself still needs its own visual treatment
6. **Mission card / XP / level / progress-ring system** — `MissionBadge` and `StreakBadge` cover two individual badges; a full gamification UI needs more
7. **Budget detail visuals** (category progress, overspending warning, under-budget success) — `BudgetIllustration` covers the generic empty/hero case
8. **Premium/billing visuals** (Free/Plus/Pro badges, upgrade illustration, billing success/failure) — `LockedBadge` covers the generic locked state; a real upgrade flow needs more
9. **Landing page feature sections + footer** — the hero, brand mark, and Track→Plan→Earn→Grow strip are done; per-feature marketing sections and a footer are still a single unbuilt block

---

# ASSET STORAGE

```
src/
  app/
    icon.tsx              ← favicon (32×32), Next.js file convention
    apple-icon.tsx         ← iOS home-screen icon (180×180)
    opengraph-image.tsx    ← default OG/link-preview image (1200×630)
  components/
    illustrations/   ← all current SVG React components live here (flat, this file's convention)
    ui/               ← shadcn/ui primitives (unrelated to this doc)
public/
    (currently only unused create-next-app scaffold SVGs — file.svg, globe.svg,
     next.svg, vercel.svg, window.svg — not part of the WEALTH OS asset system;
     left in place, out of scope for this documentation pass)
```

The originally-proposed `public/graphics/{brand,onboarding,empty-states,...}`
subfolder structure is **not** in use — every current asset is a React SVG
component, not a static file, which is the better fit for this app (no
network request, fully themeable via CSS custom properties, tree-shaken if
unused). The three exceptions are `icon.tsx`/`apple-icon.tsx`/
`opengraph-image.tsx`, which are **Next.js file-convention routes**, not
`illustrations/` components — they must live directly under `src/app/` for
Next to pick them up, and they redraw the brand mark's shapes directly in
`next/og`'s `ImageResponse` JSX rather than importing the React component
(Satori, the renderer behind `ImageResponse`, works from its own JSX tree
and can't import arbitrary React components). Keep any future change to the
brand mark in sync across all four files (`brand-mark.tsx` + these three).

Prefer, in order: SVG React component → inline SVG → static SVG file → PNG/WebP (only when necessary).

---

# IMPLEMENTATION RULES

All assets must:
- be mobile responsive and work well at 375px
- support Thai layout (long Thai strings, correct line-wrapping)
- preserve accessibility (icons carry `aria-hidden="true"` when decorative; meaningful icons get a label)
- never obscure financial data
- never expose internal IDs (verified throughout this session — see `PROJECT_STATUS.md`)
- not meaningfully hurt performance (SVG components are inline, zero extra network requests)
- follow this document's visual direction

---

# DOCUMENT RESPONSIBILITY

- **`GRAPHICS_PLAN.md`** (this file) — the only source of truth for visual direction, graphics identity, icon rules, illustration rules, asset inventory, roadmap, status, and priority.
- **`CLAUDE.md`** — product/engineering source of truth.
- **`PROJECT_STATUS.md`** — current build-state source of truth.
- **`README.md`** — setup/run/deploy documentation.
