# Asset taxonomy and valuation proposal — not applied

`0048_asset_taxonomy_valuation.sql` is a review artifact only. Nothing in this directory
is a runnable migration. It requires user approval; rename it into
`supabase/migrations` with the next free migration number when approved. Existing
migrations and generated database types are unchanged.

It enables two-level asset categories, purchase metadata, user valuation overrides,
market-price timestamps, tags, debt terms/input periods, and an explicit debt-to-payment
schedule link. All new columns are nullable. No RLS/policies/grants are changed.
Before enabling the FK in application writes, review a same-user ownership trigger
like the existing linked-account checks. A plain FK is insufficient.

A future, separately reviewed backfill can map `asset_type` through
`groupForAssetType`, leaving subcategory and purchase metadata null when unknown.
Do not invent historical purchase prices: callers may explicitly use current
`assets.value` and `created_at` as an approximation and disclose that assumption.
Depreciation overrides use positive percentages for losses and negative for gains.
`liabilities.interest_rate` continues to store annual percent; the proposed period
records the user's original input convention only.

Current capture saves work on the existing schema. Notes keep category keys,
plan numbers, and exact final payment; deterministic UUIDs and `[capture:<id>]`
markers deduplicate retries. Liability due dates are null because calendar dedupe
requires identical labels and the recurring schedule is the sole calendar source.
Recurring templates have one fixed amount: the adjusted final amount is shown in
the preview and schedule description for manual confirmation; saving a schedule
does not automatically amortize or reconcile the liability balance.
