-- =============================================================================
-- WEALTH OS — Migration 0041: Account nicknames for voice capture
--
-- "โอนเงินเข้ากระปุกหมู 1000": people call their accounts by names that
-- aren't the account's real name, or say the name the way it sounds
-- ("ไดม์" for Dime). Voice capture already matches close-sounding names
-- (src/lib/capture/transfer.ts); this table lets it REMEMBER a nickname:
-- one row per (user, nickname) → account.
--
-- Rows come from two places, recorded in `source`:
--   'user'    — typed in the account's edit form ("ชื่อเรียกตอนพูด")
--   'learned' — the user picked an account for a word voice capture didn't
--               know, with "remember this name" ticked
--
-- A plain mapping table like merchant_category_preferences (0021), not a
-- model. Never auto-created from guesses.
-- =============================================================================

create table public.account_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 1 and 60),
  -- lower-cased, whitespace-collapsed form used for matching and uniqueness.
  alias_normalized text not null check (char_length(alias_normalized) between 1 and 60),
  source text not null default 'user' check (source in ('user', 'learned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_aliases is
  'Nicknames a user says for their own accounts ("กระปุกหมู" → a savings account), used only by voice/quick capture to resolve transfer accounts.';

-- One nickname means one account for a user; saying it again re-points it.
create unique index account_aliases_user_alias_idx
  on public.account_aliases (user_id, alias_normalized);

create index account_aliases_account_idx
  on public.account_aliases (account_id);

create trigger set_account_aliases_updated_at
  before update on public.account_aliases
  for each row execute function public.set_updated_at();

-- A nickname may only point at an account of the SAME user. RLS scopes the
-- alias row itself (user_id = auth.uid()), but a foreign key alone does not
-- check who owns the referenced account — same reasoning as 0013.
create or replace function public.check_account_alias_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.accounts
    where id = new.account_id and user_id = new.user_id
  ) then
    raise exception 'account_id must reference an account owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_account_alias_ownership_trg
  before insert or update of account_id, user_id on public.account_aliases
  for each row execute function public.check_account_alias_ownership();

alter table public.account_aliases enable row level security;

create policy "account_aliases_select_own" on public.account_aliases
  for select using (user_id = auth.uid());
create policy "account_aliases_insert_own" on public.account_aliases
  for insert with check (user_id = auth.uid());
create policy "account_aliases_update_own" on public.account_aliases
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "account_aliases_delete_own" on public.account_aliases
  for delete using (user_id = auth.uid());
