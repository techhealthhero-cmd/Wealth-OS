-- =============================================================================
-- WEALTH OS — Migration 0021: Quick Capture ("capture first, organize later")
--
-- Reuses the existing `transactions` table for every captured expense — no
-- parallel drafts table. A quick-captured expense is a REAL transaction the
-- moment the user confirms it (it moves account balances and dashboard
-- totals immediately, because the money really was spent); what "review"
-- adds is only a flag that its category/details were guessed and still
-- deserve a glance in the Daily Inbox.
--
-- Additive and backward-compatible: every existing row keeps
-- review_status = 'confirmed' (the column default) and null for the new
-- nullable columns, i.e. exactly the behavior it had before.
-- =============================================================================

-- 1) Where a transaction came from. 'import' (already allowed) stays the
--    value for future bank imports.
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'seed', 'import', 'recurring', 'quick_text', 'voice', 'receipt'));

-- 2) Daily Inbox review state.
alter table public.transactions
  add column review_status text not null default 'confirmed'
    check (review_status in ('confirmed', 'needs_review'));

-- 3) How sure the parser/OCR was when the transaction was captured.
alter table public.transactions
  add column ai_confidence text
    check (ai_confidence is null or ai_confidence in ('high', 'medium', 'low'));

-- 4) Payment-slip reference number (when a slip shows one) — used only for
--    duplicate detection before saving a scanned slip.
alter table public.transactions
  add column reference text
    check (reference is null or char_length(reference) <= 80);

create index transactions_user_needs_review_idx
  on public.transactions (user_id, transaction_date desc)
  where review_status = 'needs_review';

create index transactions_user_reference_idx
  on public.transactions (user_id, reference)
  where reference is not null;

-- =============================================================================
-- merchant_category_preferences — lightweight "category learning".
-- One row per (user, normalized merchant): "grab" → Transport. Updated when
-- the user confirms or corrects a category; read by the capture parser to
-- suggest it next time. Deliberately a plain mapping table, not an ML model.
-- =============================================================================
create table public.merchant_category_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_normalized text not null
    check (char_length(merchant_normalized) between 1 and 120),
  category_id uuid not null references public.categories(id) on delete cascade,
  usage_count integer not null default 1 check (usage_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, merchant_normalized)
);

create index merchant_category_preferences_user_idx
  on public.merchant_category_preferences (user_id);

create trigger set_merchant_category_preferences_updated_at
  before update on public.merchant_category_preferences
  for each row execute function public.set_updated_at();

-- A preference may only point at a system category or one of the SAME
-- user's own categories — a plain FK doesn't check ownership (same
-- reasoning as 0013's liability↔account trigger).
create or replace function public.check_merchant_pref_category_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.categories c
    where c.id = new.category_id
      and (c.is_system = true or c.user_id = new.user_id)
  ) then
    raise exception 'category_id must be a system category or one owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_merchant_pref_category_ownership_trg
  before insert or update of category_id on public.merchant_category_preferences
  for each row execute function public.check_merchant_pref_category_ownership();

alter table public.merchant_category_preferences enable row level security;

create policy "merchant_category_preferences_select_own" on public.merchant_category_preferences
  for select using (user_id = auth.uid());
create policy "merchant_category_preferences_insert_own" on public.merchant_category_preferences
  for insert with check (user_id = auth.uid());
create policy "merchant_category_preferences_update_own" on public.merchant_category_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "merchant_category_preferences_delete_own" on public.merchant_category_preferences
  for delete using (user_id = auth.uid());
