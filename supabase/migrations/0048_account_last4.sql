-- =============================================================================
-- WEALTH OS — Migration 0048: Last 4 digits of an account number
--
-- Thai bank slips print the paying account masked: "xxx-x-x8710-x". When the
-- user types those same 4 digits on their account ("เลขท้ายบัญชี 4 ตัว"), a
-- slip from x8710 goes to exactly that account — no guessing between several
-- accounts at the same bank (the user's "jar" accounts are all at กสิกร).
--
-- Only the last 4 digits, never a full account number: it's what the slip
-- itself shows, and all the app needs. Optional; existing rows stay null.
-- RLS: covered by the existing accounts policies (row-level, every column).
-- =============================================================================

alter table public.accounts
  add column account_last4 text
  check (account_last4 is null or account_last4 ~ '^\d{4}$');

comment on column public.accounts.account_last4 is
  'Last 4 digits of the account number, as printed masked on bank slips. Matches incoming slips to this account.';
