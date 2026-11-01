-- =============================================================================
-- WEALTH OS — Migration 0049: Full account number, matched against slip masks
--
-- 0048 stored "the last 4 digits", but a K PLUS slip prints the paying
-- account as "xxx-x-x8710-x": the visible digits are NOT the last four (the
-- final digit is masked). The user's ask: store the account's whole number
-- once, and let a slip match it wherever its visible digits sit.
--
--   accounts.account_number     — digits only ("1234588710" for
--                                 123-4-58871-0), optional, set by the user.
--   slip_inbox.payer_account    — now the slip's mask as printed, separators
--                                 removed, hidden digits as "x":
--                                 "xxx-x-x8710-x" → "xxxxx8710x". Rows read
--                                 before this keep their plain digits ("8710").
--
-- accounts.account_last4 (0048) is dropped: it never held a value on any
-- database (checked before writing this), and the guard below refuses to
-- drop it if one ever does.
-- RLS: covered by the existing accounts / slip_inbox policies (row-level).
-- =============================================================================

do $$
begin
  if exists (select 1 from public.accounts where account_last4 is not null) then
    raise exception 'accounts.account_last4 holds data — move it to account_number before dropping';
  end if;
end;
$$;

alter table public.accounts drop column account_last4;

alter table public.accounts
  add column account_number text
  check (account_number is null or account_number ~ '^\d{6,20}$');

comment on column public.accounts.account_number is
  'The account number, digits only. Matched against the masked paying account printed on bank slips.';

alter table public.slip_inbox drop constraint if exists slip_inbox_payer_account_check;
alter table public.slip_inbox
  add constraint slip_inbox_payer_account_check
  check (payer_account is null or payer_account ~ '^[0-9x]{3,20}$');

comment on column public.slip_inbox.payer_account is
  'Paying account as printed on the slip, separators removed, masked digits as x ("xxxxx8710x"). Older rows: visible digits only.';
