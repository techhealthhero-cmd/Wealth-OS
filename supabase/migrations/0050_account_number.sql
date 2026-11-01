-- =============================================================================
-- WEALTH OS — Migration 0050: Full account number, matched against slip masks
--
-- Staging port of production 0049_account_number.sql. Production 0048 stored
-- "the last 4 digits", then 0049 dropped that column (it never held a value)
-- because a K PLUS slip prints the paying account as "xxx-x-x8710-x": the
-- visible digits are NOT the last four. Staging never created account_last4,
-- so this migration only adds the final column.
--
--   accounts.account_number — digits only ("1234588710" for 123-4-58871-0),
--                             optional, set by the user. Matched against
--                             slip_inbox.payer_account wherever the visible
--                             digits sit.
--
-- RLS: covered by the existing accounts policies (row-level).
-- =============================================================================

alter table public.accounts
  add column account_number text
  check (account_number is null or account_number ~ '^\d{6,20}$');

comment on column public.accounts.account_number is
  'The account number, digits only. Matched against the masked paying account printed on bank slips.';
