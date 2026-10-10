-- =============================================================================
-- WEALTH OS — Migration 0042: Pay-from account per shop
--
-- "ซื้อแซนวิชในเซเว่น 30": some shops are always paid from one account — a
-- 7-Eleven purchase comes out of the 7-Eleven app wallet, which the user tops
-- up from Cash. One row per (user, shop) → account, read by quick/voice
-- capture to pick the account for a purchase at that shop.
--
-- Same plain-mapping shape as merchant_category_preferences (0021) and
-- account_aliases (0041). Rows come from the user, never from a guess:
--   'user'    — added in the account's edit form
--   'learned' — the user answered "pay from which account?" with
--               "remember" ticked
-- =============================================================================

create table public.merchant_account_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- normalizeMerchant() of the shop's canonical name ("7-eleven").
  merchant_normalized text not null check (char_length(merchant_normalized) between 1 and 120),
  -- What the user saw/typed, for display ("7-Eleven").
  merchant_label text not null check (char_length(btrim(merchant_label)) between 1 and 120),
  source text not null default 'user' check (source in ('user', 'learned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.merchant_account_preferences is
  'The account a user pays a given shop from ("7-eleven" → their 7-Eleven wallet). Used only to pre-select the account when capturing a purchase; never moves money.';

-- One shop is paid from one account; choosing again re-points it.
create unique index merchant_account_preferences_user_merchant_idx
  on public.merchant_account_preferences (user_id, merchant_normalized);

create index merchant_account_preferences_account_idx
  on public.merchant_account_preferences (account_id);

create trigger set_merchant_account_preferences_updated_at
  before update on public.merchant_account_preferences
  for each row execute function public.set_updated_at();

-- The account must belong to the same user (a foreign key alone doesn't
-- check ownership of the referenced row — same reasoning as 0013 / 0041).
create or replace function public.check_merchant_account_pref_ownership()
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

create trigger check_merchant_account_pref_ownership_trg
  before insert or update of account_id, user_id on public.merchant_account_preferences
  for each row execute function public.check_merchant_account_pref_ownership();

alter table public.merchant_account_preferences enable row level security;

create policy "merchant_account_preferences_select_own" on public.merchant_account_preferences
  for select using (user_id = auth.uid());
create policy "merchant_account_preferences_insert_own" on public.merchant_account_preferences
  for insert with check (user_id = auth.uid());
create policy "merchant_account_preferences_update_own" on public.merchant_account_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "merchant_account_preferences_delete_own" on public.merchant_account_preferences
  for delete using (user_id = auth.uid());
