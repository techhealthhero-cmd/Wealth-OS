# WEALTH OS — UX PRINCIPLES

**This is the highest-priority governing document for how WEALTH OS behaves
and communicates.** When a UX decision in this file conflicts with visual
preference, a feature request's literal wording, or convenience for the
person implementing it, this file wins. It governs *behavior and
structure* — information hierarchy, card design, what a screen should ask
of the user, how much the interface should explain itself, tone, and
decision load. `GRAPHICS_PLAN.md` governs *visual style* (color, motion,
icon/illustration rules) for the same surfaces, subordinate to the
priorities below when the two would otherwise pull in different
directions (e.g. a visual trend that would add decision load or hide the
next action loses to this file). Read this file before designing a new
screen, reorganizing an existing one, or adding a new card/CTA — before
`GRAPHICS_PLAN.md`, not after.

See `CLAUDE.md`'s "Document Ownership" section for the canonical map of
which document owns what and how precedence works between them — this
file doesn't keep its own copy of that list.

## The one rule everything else here serves

> **Complex system, simple interface.**
> The user always understands their financial situation and knows what to
> do next.

A user opening WEALTH OS should think "I understand my money," "I know
what needs attention," "I know what to do next" — never "there's too much
information," "I don't understand this chart," or "what does this number
mean?"

## Priority order when trade-offs are unavoidable

1. Ease of use
2. Understandability
3. Clear next action
4. Information hierarchy
5. Speed
6. Accessibility
7. Responsive behavior
8. Visual consistency
9. Premium visual quality
10. Advanced analytics

Never sacrifice something higher on this list for something lower.
Aesthetics (9) never wins over usability (1) or a broken mobile layout (7).

---

## 1. One screen = one primary purpose

Every screen must have one clear primary user goal.

**In practice**: before adding a new section to an existing page, ask what
that page's ONE job already is. The Dashboard's job is "tell me where I
stand and what to do next" — this is why Net Worth and Next Best Action
lead it, and why Wealth Score/Life Stage/Safe-to-Spend live lower, under
"More insights," instead of competing for the same visual weight.

## 2. One card = one idea

Do not overload cards with unrelated financial metrics.

**In practice**: a card answers one question. `NetWorthHero` answers "am I
wealthier?" — it does not also try to show budget status or goal progress.
When a card starts accumulating unrelated numbers "because there's room,"
split it.

## 3. Action before analytics

Prioritize what the user should do next before detailed analytics.

**In practice**: this is why `NextBestActionCard` sits immediately after
the Net Worth hero — before the monthly income/expense breakdown, before
charts, before Wealth Score. A user should see "what to do" before they see
"here is more data about your situation."

## 4. Progressive disclosure

Show essential information first. Reveal advanced financial details only
when requested.

**In practice**: `WealthScoreCard`/`LifeStageCard`/`SafeToSpendCard`
already do this — the headline number is always visible, and the
component-by-component breakdown only renders behind a "View details"
tap. Follow this pattern for any new card that has both a summary number
and a detailed breakdown, rather than showing both at once.

## 5. Never make users interpret raw financial data

Translate numbers into plain-language meaning and actionable context.

**In practice**: don't render a bare score, percentage, or delta with no
label. `NextBestActionCard` doesn't just show "Emergency Fund: 1.6" — it
says the fund covers about 1.6 months of expenses, and what to add. A
number without a sentence around it is a half-finished feature.

Escalate the amount of context as the number gets more surprising:
- Plain value: `Food ฿8,240`
- With context: `Food ฿8,240 — ฿1,240 above your monthly plan`
- With a next step: `Food spending is ฿1,240 above your plan. Reducing
  spending by about ฿40/day would put you back on track.`
Use the level of context proportional to how actionable the number is —
a routine number needs a label, a number worth acting on deserves a
sentence telling the user what to do about it.

## 6. Minimize decisions

Prefer 1 primary CTA and no more than 2-3 secondary actions per section.

**In practice**: `Button`'s `default` variant is reserved for the one
primary action in view. When a card/section is tempted to add a third or
fourth button, that's a signal the section is trying to do more than one
job — see principle 1.

## 7. Complex system, simple interface

The underlying financial engine may be complex, but the user experience
must remain simple enough for a new user to understand without
instructions.

**In practice**: Wealth Score's calculation spans seven weighted
components; the Priority Engine evaluates cash flow, debt, emergency fund,
and goals together. None of that complexity should ever be a precondition
for using the app — a first-time user with one account and one
transaction should still get a clear, correct Net Worth number and a
sensible first Next Best Action.

## 8. Coach, never judge

WEALTH OS is a coach/guide/assistant — never a judge, police, or a teacher
scolding the user. Never shame.

Avoid: *"You failed your budget." "Bad spending." "You spent too much."*
Prefer: *"Food spending is ฿1,240 above your current plan. Reducing
spending by about ฿40/day would put you back on track this month."* Same
fact, no verdict attached to the user's character.

## 9. Never guarantee outcomes

Never use copy that promises wealth, guaranteed investment returns,
becoming rich, or profit — this is a business/legal rule (see
`CLAUDE.md`), not a style preference, and it applies to every surface:
dashboard copy, AI responses, notifications, marketing pages. Help users
take informed action; never claim a guaranteed result.

## 10. Every empty state moves the user forward

An empty state is not "no data" — it's the first step of a task. Never
show a dead interface (`฿0`, `No data`, `No transactions`) with nothing to
do about it. Structure every empty state as: what this is → why it
matters → one obvious next action. `EmptyState`
(`src/components/shared/empty-state.tsx`) already has this shape
(illustration + title + description + action) — use it rather than a
bespoke layout, and always pass a real `description` and `action`.

## 11. Plain language over technical terminology

Prefer the words a non-finance friend would use. *"เงินพร้อมใช้"* over
*"Safe-to-Spend"* as the primary label; *"คุณยังใช้ได้อีกประมาณ ฿620
วันนี้"* over showing only the bare number. Technical terms can appear as
a secondary/expanded explanation, never as the only label a first-time
user sees.

## 12. Reduce work, not only screens

A simple UX is not merely fewer pages — it's less *repeated effort*. Every
repeated user action should trend toward faster, smarter, prefilled,
suggested, or automated (where safe): remember the previous account
selection, suggest a likely category, surface a recurring obligation
before it's due, default sensibly instead of asking. Never automate an
irreversible financial action without a clear confirmation step.

## 13. Insight → meaning → action

An insight that ends at a raw number is unfinished. Escalate as far as the
situation warrants (see principle 5's escalation ladder), and when an
insight is actionable, always end on an offered action, not just a fact.

*"Food spending +24%"* → *"Food spending increased ฿1,860 from last
month."* → *"Food spending increased ฿1,860 from last month. Reducing
about ฿60/day for the rest of the month would bring you close to your
current plan." [Create a plan]*

## 14. Personal relevance beats feature visibility

Never show something prominently merely because the feature exists. UI
priority adapts to the user's actual situation: a weak emergency fund
makes Emergency Fund more prominent; high-interest debt makes a debt
action more prominent; stable finances with a large income gap makes Earn
more relevant; no debt means Debt Planner should *not* be visually
prioritized; a completed goal loses prominence in favor of the next
meaningful one. The interface responds to the user, not to a fixed
template — this is what `NextBestActionCard` already does by construction
(see `CLAUDE.md`'s Next Best Action Engine priority order), and the same
logic should extend to which secondary cards get visual weight.

## 15. One moment = one recommended action

A user can have several open financial issues at once. Never present five
equally-urgent recommendations side by side. Prefer one clearly
prioritized "most important right now," with a secondary path — "view
other recommended actions" — for the rest. Build this on the existing
deterministic Priority/Next Best Action Engine; never invent a second,
competing prioritization.

## 16. Measure financial progress, not app activity

DAU, session duration, tap count, and streak length are supporting
signals at best, never the definition of success — see
`PRODUCT_OUTCOMES.md`'s Useful Retention and outcome hierarchy. When
choosing between a change that increases engagement and one that
increases the odds a user takes a genuinely useful action, choose the
latter.

## 17. Personalization reduces decision load, never manipulates

WEALTH OS should behave like a personal financial operating system, not a
static dashboard — prioritizing what it shows based on real user state
(cash flow, debt, emergency fund, goals, income gap, spending behavior,
upcoming obligations, recurring transactions, detected subscriptions,
mission progress). Use personalization only to reduce what the user has
to figure out for themselves, never to nudge them toward an outcome that
serves engagement over their actual financial interest.

---

See `CLAUDE.md`'s "Document Ownership" section for which document owns
what, and `PRODUCT_OUTCOMES.md` for the user-outcome/success-metric
questions this file's principles exist to serve.
