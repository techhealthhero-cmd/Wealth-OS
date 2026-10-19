# Safe to spend today

`getSafeToSpendToday(today: string)` is a server-only, read-only loader. Supply a
validated local calendar date (`YYYY-MM-DD`). Success returns `success: true`,
`totalCents`, `perDayCents`, `daysLeft`, `horizonEnd`, `horizonReason`, `isShort`,
`breakdown`, `warnings`, and `assumptionsStatus: 'approved'`.
The breakdown contains spendable liquid cash, excluded earmarked balances,
unpaid bills (sorted by date then label), bill total, tax shortfall and emergency
top-up. All amounts are integer satang; unsafe or fractional amounts throw.

No accounts returns `{ success: false, reason: 'no_accounts' }`. Invalid dates
and unauthenticated requests return `{ error }`. Tax-jar loader errors yield a
`tax_jar_unavailable` warning and omit the tax reserve. Other database read errors
are surfaced rather than silently inventing balances. The pure function is
`computeSafeToSpendToday` in `src/lib/financial/safe-to-spend-today.ts`.

## Assumptions (approved 2026-10-19)

Formula approved by the user on 2026-10-19 at 21:14 Asia/Bangkok (PR #31).

- Liquid account types are cash, bank and e_wallet, using existing account balances.
- Emergency-fund linked accounts and tax-jar accounts are earmarked: their entire
  liquid balances are excluded from spendable cash (once per account).
- Horizon ends the day before the earliest active, unended recurring income
  occurrence strictly after today, or at month end, whichever is earlier.
  Stale income due dates advance using existing recurring frequency stepping.
  Income dates on/before today are ignored by the pure calculation. Days include
  today and the horizon end; income tomorrow means one day. Ties use next_income.
- All active unpaid payment-calendar occurrences through the horizon count,
  including overdue bills before today. Existing calendar frequency/end-date and
  duplicate rules apply, including verified paid items suppressing unpaid mirrors.
- Liabilities count their minimum payment on due_date via the payment calendar.
  Income schedules are excluded from payment sources by that loader.
- Tax target is rate% × YTD income received (income transactions dated January 1
  through today in today's Gregorian tax year), using calculateSetAside rounding.
  Reserve is max(0, target minus jar balance), only when a settings row exists.
  Missing configuration or unavailable tax-jar loaders means no tax reserve.
- Emergency top-up is this month's monthly_contribution capped at the remaining
  target gap, using current_amount and the existing essential-expense target
  formula. It assumes the contribution has not yet been made this month.
  No configuration, no positive contribution, or a funded target means zero.
- Unpaid invoices/receivables are excluded entirely; they are not received cash.
- Total = liquid cash − bills − tax shortfall − emergency top-up; it may be
  negative. isShort means total < 0. Per-day is floor(total / inclusive days),
  or zero when total is zero or short.
- Nothing is written to the database. There are no UI/Home integrations.

The legacy `getSafeToSpend()` and `calculateSafeToSpend` are unchanged.
