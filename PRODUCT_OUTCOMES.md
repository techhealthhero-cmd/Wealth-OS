# WEALTH OS — PRODUCT OUTCOMES

**This document owns the product North Star, user outcomes, and success
metrics — how we know WEALTH OS is actually helping the user**, as opposed
to merely being used. See `CLAUDE.md`'s "Document Ownership" section for
how this fits with the other project docs.

---

## Product North Star

WEALTH OS exists to help users make better financial decisions and
**measurably improve their financial position over time.**

A successful user should increasingly be able to say:

- I understand my financial situation.
- I know what needs attention.
- I know my most important next action.
- I am making progress.
- I feel more in control of my money.
- I am improving my ability to earn, save, reduce harmful debt, and build
  wealth.

Never turn this into a promise that the user will become rich. Never
guarantee wealth, investment returns, profit, or specific financial
outcomes (this rule is owned by `CLAUDE.md`; repeated here because it
directly bounds what "success" is allowed to mean). Optimize instead for:

> **Measurable improvement in the user's financial position over time.**

---

## Primary user outcomes

No single metric below is universally correct for every user — a
freelancer's healthy pattern (irregular income, high income-growth focus)
looks different from a salaried employee's (steady income, debt-payoff
focus). Use these as the *categories* of progress the product should be
able to show, not a fixed scorecard every user must fill in.

**Financial clarity** — the user understands income, expenses, cash flow,
debt, savings, assets, liabilities, and net worth without needing finance
expertise.

**Financial resilience** — emergency fund coverage, fewer negative
cash-flow periods, reduced overdue obligations, improved savings
consistency.

**Debt improvement** — high-interest debt declining, debt payoff progress,
fewer overdue debt obligations.

**Income growth** — increased earned income, additional income streams,
reduced income-concentration risk, progress toward an income target,
completed income missions.

**Wealth progress** — net worth trend, goal progress, savings progress,
appropriate investment progress.

---

## Useful retention

WEALTH OS earns retention through usefulness, never through engagement
mechanics. Never optimize primarily for screen time, endless scrolling,
notification opens, login streaks, excessive daily sessions, meaningless
taps, or artificial urgency.

**A user spending 45 seconds completing the right financial action is more
successful than a user browsing the app for 20 minutes.**

Users should return because:

- their financial data changed
- an important obligation needs attention
- a meaningful Next Best Action exists
- a goal needs progress
- a monthly review is due
- an income mission is useful
- the app found something worth reviewing

Call this **Useful Retention**: product engagement exists to serve
financial progress, not the other way around.

---

## Healthy gamification

Gamification (XP, streaks, missions — see `CLAUDE.md`'s Product Systems)
may reward *meaningful financial behavior*. It may not reward *activity
for its own sake*.

May deserve XP/progress: creating a useful budget, tracking real
transactions, reviewing subscriptions, contributing toward a goal,
improving emergency savings, completing an income mission, completing a
monthly financial review.

Must never be rewarded merely for engagement: opening the app, random
taps, scrolling, visiting arbitrary pages, a daily login streak with no
underlying financial action.

> Never reward activity that creates engagement without financial value.

No casino-style engagement loops. No punitive streak resets. No
guilt-based retention.

---

## Next Best Action as the product's center

WEALTH OS's core loop is:

```
Financial Data → Deterministic Analysis → Priority Engine
  → Next Best Action → User Action → Updated Financial State
  → New Next Best Action
```

It is explicitly **not**:

```
Financial Data → More Charts → More Charts → More Charts
```

Charts support decisions; they are not the product. Every other document
(`UX_GUIDELINES.md`'s hierarchy principles especially) should reinforce
this loop rather than compete with it.

---

## Outcome Measurement Model

Separate any metric into one of three levels. Don't conflate them — a
healthy Product Health Metric with worsening Financial Progress Metrics
means the product is failing at its actual job, however engaged users are.

### 1. User Action Metrics — leading indicators

Whether users complete meaningful financial actions: Next Best Action
completion, budget creation/adjustment, emergency fund contribution, debt
payment, detected-subscription review, goal contribution, income mission
completion, monthly review completion, recurring-obligation confirmation,
savings action completion. Never count a meaningless interaction (a tap, a
page visit) as a User Action Metric.

### 2. Financial Progress Metrics — outcome indicators

Whether the user's real financial position is changing: savings rate
trend, emergency fund coverage in months, high-interest debt trend,
overdue-obligation frequency, negative-cash-flow frequency, net worth
trend, income trend, income concentration risk, income target progress,
goal progress, unnecessary recurring-cost reduction. No single one of
these defines success for every user — a debt-free user has no debt trend
to improve, an irregular-income freelancer's "income trend" looks
different from a salaried employee's.

### 3. Product Health Metrics — supporting indicators

Whether the product remains useful enough to retain users: activation
rate, Next Best Action completion rate, 30-/90-day Useful Retention,
recommendation acceptance/dismissal/snooze rate, monthly review completion
rate, meaningful-action frequency, feature usefulness by user context.

**Product Health Metrics must never override Financial Progress Metrics.**
A feature that raises Product Health numbers while not helping (or
actively working against) Financial Progress Metrics is a regression, not
a win.

---

## Activation Moment

"Activation rate" (a Product Health Metric above) needs a real definition,
not an implementation-convenience proxy. Activation is **not**:

- an account being created (Supabase Auth signup)
- `profiles.onboarding_completed = true`
- the dashboard being opened once

Any of those can be true for a user the product has told nothing real. A
user is **activated** the first moment the app has enough real financial
data to produce one genuinely personalized, non-fabricated action for
them — i.e. the first time `getFinancialPriority()` (the deterministic
Priority Engine, see CLAUDE.md's Next Best Action Engine) returns a real,
non-null priority grounded in the user's own transactions/accounts, or —
absent any urgent issue — the first time a real calculated metric (Safe-to-
Spend, a cash-flow read, a savings-rate read backed by actual income data)
can be shown without guessing. Before that point, the honest state is "not
enough data yet" (see the Priority Engine's `hasIncomeThisPeriod` guard and
`NextBestActionCard`'s `hasTransactionHistory` branch, both added during the
Onboarding + First Value pass) — never a fabricated "you're all healthy."

This makes activation something the product earns by getting the user to
real data (one account, one transaction) fast, not something onboarding can
mark true by itself. `onboarding_completed` and activation are deliberately
different flags: completing onboarding lets a user *into* the product
safely; activation is the product actually *working* for them.

---

## Next Best Action completion rate

Conceptually: *completed recommended actions ÷ actionable recommendations
shown.* Never reduce this to simple clicked/not-clicked tracking — that
produces false conclusions like "the user didn't complete it, therefore
the recommendation was bad," when the real reason might be that a higher
priority superseded it before the user acted.

Track richer states instead: **shown → opened → accepted → completed**,
or **dismissed / snoozed / no longer relevant / superseded by a higher
priority / expired**. `no longer relevant` and `superseded` in particular
mean the Priority Engine did its job (the user's situation changed, or a
more urgent item took over) — they are not failures to be tuned away.

## Financial Outcome Delta

The product-facing concept: *"Since you started using WEALTH OS: Emergency
Fund +1.7 months, Debt −฿44,000, Income +฿7,000/month, Net Worth
+฿85,000."* This is a genuinely strong retention/motivation moment when
it's real — and actively harmful if faked.

**Current data support (verified against `supabase/migrations/`, not
assumed):**

| Metric | Historical data available? | Why |
|---|---|---|
| Net Worth | ✅ Yes | `net_worth_snapshots` is a real daily time-series table |
| Wealth Score | ✅ Yes | `wealth_scores` is explicitly append-only history (one row per calculation) |
| Income | ✅ Yes (derivable) | Reconstructable from the `transactions` ledger, which is itself a full history |
| Emergency Fund | ❌ No | `emergency_funds` stores only a single current `current_amount` per user — no snapshot history exists |
| Debt | ❌ No | `liabilities.balance` is updated in place — no snapshot history exists; reconstructing from `debt_payment` transactions alone would miss interest accrual and non-transaction adjustments, producing a misleading number |

**Conclusion**: a Financial Outcome Delta feature can be built truthfully
today for Net Worth, Wealth Score, and Income. It cannot yet be built
truthfully for Emergency Fund or Debt without either (a) adding a periodic
snapshot table for each (the same pattern `net_worth_snapshots` already
uses), or (b) scoping the feature to the three metrics that already
support it and clearly omitting the other two rather than approximating
them. This is a real, documented product opportunity — not something to
implement by inventing a "close enough" number for the unsupported
metrics.

---

## Outcome hierarchy (what to optimize for, in order)

1. Is the user's financial understanding improving?
2. Is the user taking the recommended next action?
3. Is the user's financial position (net worth, resilience, debt, income)
   improving over time?
4. Is the user returning because the app is useful (Useful Retention)?
5. Is the user engaged with the app? (a supporting signal only — never the
   goal itself; see Useful Retention above)

DAU, session duration, taps, and streak length are supporting metrics at
best. The primary question is always: **is the user making useful
financial progress?**
