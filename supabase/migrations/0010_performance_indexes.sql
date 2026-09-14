-- =============================================================================
-- WEALTH OS — Migration 0010: Day 8 Performance Audit — missing index
--
-- Found via STEP 3 (database safety audit): every foreign key column across
-- the schema was checked against the live index list. Nearly all are
-- already covered; the one genuinely load-bearing gap is
-- `transactions.category_id` — `src/features/transactions/queries.ts`'s
-- `getTransactions()` filters directly on it (`filters.categoryId`), and
-- `transactions` is this app's largest, fastest-growing table (every
-- income/expense entry, for every user, forever). Every other transactions
-- filter already has a covering index (`user_date_idx`, `user_type_idx`,
-- the three account-id indexes); this was the one missing piece.
--
-- Three smaller FK gaps were also found and deliberately NOT indexed here:
-- `debt_plan_priorities.liability_id`, `income_missions.related_opportunity_id`,
-- and `recurring_transactions.{category_id,account_id,from_account_id,to_account_id}`.
-- Each of those tables holds a small, bounded number of rows per user (a
-- handful of debt-plan-priority rows, a fixed 10-step income-mission
-- sequence, a handful of recurring items) and none of them is filtered by
-- that specific column in any current query — adding indexes with no
-- measurable query to justify them would be exactly the premature
-- optimization STEP 7 warns against. Revisit if a future feature adds a
-- query that actually filters on one of these.
-- =============================================================================

create index transactions_user_category_idx
  on public.transactions (user_id, category_id)
  where category_id is not null;
