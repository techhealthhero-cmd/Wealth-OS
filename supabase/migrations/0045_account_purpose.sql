-- =============================================================================
-- WEALTH OS — Migration 0045: What each account's money is for
--
-- A short, optional label such as "ใช้จ่ายรายวัน" or "เงินสำรองฉุกเฉิน".
-- It is shown on the back of a flipped account card instead of the balance,
-- so a card can be turned over while showing someone the app without it
-- looking hidden. Display text only: no calculation reads it.
--
-- Existing rows stay null; the card then falls back to the account type.
-- RLS: covered by the existing accounts policies (row-level, every column).
-- =============================================================================

alter table public.accounts
  add column purpose text
  check (purpose is null or char_length(btrim(purpose)) between 1 and 40);

comment on column public.accounts.purpose is
  'Optional label for what this money is for ("ใช้จ่ายรายวัน"). Shown on the flipped card; never used in calculations.';
