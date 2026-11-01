-- =============================================================================
-- WEALTH OS — Migration 0047: Slip memo + paying account
--
-- Two things a slip prints that 0046 didn't keep:
--
--   note          — the memo the payer typed ("บันทึกช่วยจำ: ชาเขียว"). Shown
--                   on the waiting slip, used to suggest the category, and
--                   saved as the transaction's description on ✓.
--   payer_account — the last digits of the PAYING account as printed
--                   ("xxx-x-x8710-x" → "8710"). Never a full account number:
--                   slips only print it masked. Lets the app remember which
--                   of the user's accounts that card/account is (through
--                   account_aliases, 0041), so the next slip picks it itself.
--
--   read_version  — which slip reader produced the row. Rows read before this
--                   migration are 1; the reader that also reads the memo and
--                   payer is 2. A still-PENDING slip with an older version is
--                   read once more when the Shortcut resends the same photo,
--                   so slips already waiting get their memo too.
--
-- Existing rows: note/payer_account null, read_version 1. Nothing else
-- changes. RLS: covered by the existing slip_inbox policies (row-level).
-- =============================================================================

alter table public.slip_inbox
  add column note text check (note is null or char_length(note) <= 200),
  add column payer_account text check (payer_account is null or payer_account ~ '^\d{3,4}$'),
  add column read_version smallint not null default 1 check (read_version between 1 and 100);

comment on column public.slip_inbox.note is
  'Memo printed on the slip ("บันทึกช่วยจำ"). Becomes the transaction description on confirm.';
comment on column public.slip_inbox.payer_account is
  'Last 3-4 digits of the paying account as printed on the slip (masked there). Used to remember which account pays.';
comment on column public.slip_inbox.read_version is
  'Slip reader version that produced this row; a pending row from an older reader is re-read once when resent.';
