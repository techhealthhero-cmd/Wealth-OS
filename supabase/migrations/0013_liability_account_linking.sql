-- =============================================================================
-- WEALTH OS — Migration 0013: Liability ↔ Account linking (credit-card
-- double-counting fix)
--
-- Verified architecture (2026-09 audit, not assumed): `accounts` rows with
-- account_type = 'credit_card' are an optional transaction ledger whose
-- balance can legitimately go negative (see CLAUDE.md "CREDIT CARD ACCOUNT
-- SEMANTICS"); `liabilities` rows with liability_type = 'credit_card' are
-- the authoritative debt-planning object (interest rate, minimum payment,
-- due date, Debt Health, Priority Engine). Nothing links them today, so a
-- user who tracks the same physical card in both places has that debt
-- subtracted from Net Worth twice — once as a negative account balance,
-- once as a positive liability balance.
--
-- Mirrors the EXISTING, already-shipped `assets.linked_account_id` pattern
-- (see 0003_wealth_engine.sql's header) as closely as the domain allows:
-- optional, nullable, purely a bookkeeping link. `calculateNetWorth()`
-- (application code, not this migration) is responsible for using it to
-- avoid double-counting — see that function's updated doc comment.
--
-- Two things go beyond the assets precedent, both requested explicitly for
-- this pass rather than copied blindly:
--
-- 1. Ownership is enforced with a trigger, not left to application trust.
--    `assets.linked_account_id` has no equivalent DB-level check today (a
--    pre-existing, separate gap — not touched here, out of this task's
--    scope). For liabilities we add one: a linked account must belong to
--    the same user as the liability. RLS already guarantees
--    `NEW.user_id = auth.uid()` on every insert/update that reaches this
--    trigger (see liabilities_insert_own/liabilities_update_own below), so
--    checking the account against NEW.user_id is equivalent to checking it
--    against auth.uid() and cannot be spoofed by a client-supplied value.
--
-- 2. A partial unique index prevents linking two different liability rows
--    to the same account — there is no valid product reason for two
--    liability records to represent one physical card's debt
--    simultaneously (that would just be duplicate data entry, not a
--    legitimate case, unlike "two identical ฿80 coffee purchases" for
--    transactions).
--
-- Backward-compatible and non-destructive: every existing liability row
-- gets `linked_account_id = null` (the column default), which is exactly
-- "unlinked, behaves exactly as before" — no migration guesses a link from
-- name/balance/institution similarity, per this task's explicit
-- instruction not to auto-link existing data.
-- =============================================================================

alter table public.liabilities
  add column linked_account_id uuid references public.accounts(id) on delete set null;

comment on column public.liabilities.linked_account_id is
  'Optional bookkeeping link to the accounts row that already represents this same physical debt (typically a credit_card account) — see CLAUDE.md "CREDIT CARD ACCOUNT SEMANTICS". When set, calculateNetWorth() excludes this liability from totalLiabilitiesCents (the linked account''s balance already counts it) but the liability row is otherwise unaffected: it still feeds Debt Health, the Priority Engine, and interest/minimum-payment tracking exactly as an unlinked liability would.';

create index liabilities_linked_account_idx
  on public.liabilities (linked_account_id)
  where linked_account_id is not null;

-- No two liabilities should represent the same linked account.
create unique index liabilities_user_linked_account_idx
  on public.liabilities (user_id, linked_account_id)
  where linked_account_id is not null;

-- Cross-user link prevention (Part B, Phase 11) — never trust the client;
-- RLS scopes the liabilities row itself, but a foreign key alone does not
-- verify the REFERENCED account belongs to the same user, so that check is
-- added explicitly here.
create or replace function public.check_liability_linked_account_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linked_account_id is not null then
    if not exists (
      select 1 from public.accounts
      where id = new.linked_account_id and user_id = new.user_id
    ) then
      raise exception 'linked_account_id must reference an account owned by the same user';
    end if;
  end if;
  return new;
end;
$$;

create trigger check_liability_linked_account_ownership_trg
  before insert or update of linked_account_id on public.liabilities
  for each row execute function public.check_liability_linked_account_ownership();
