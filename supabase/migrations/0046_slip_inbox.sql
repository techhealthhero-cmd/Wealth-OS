-- =============================================================================
-- WEALTH OS — Migration 0046: Slip inbox + capture tokens
--
-- "ส่งสลิปอัตโนมัติ": an iPhone Shortcut (or a multi-select upload in the app)
-- sends bank/e-wallet slips in bulk. Each one is read and categorized, then
-- WAITS here until the user confirms it. A slip in this table is NOT a
-- transaction — it never touches a balance, a dashboard or a budget until the
-- user taps ✓ (then a normal `transactions` row is created through the usual
-- capture save, and the slip row points at it).
--
-- capture_tokens: a personal key for the Shortcut. Only its SHA-256 hash is
-- stored (the key itself is shown once, at creation). It can do exactly one
-- thing — add slips to this user's slip inbox — and is revocable at any time.
-- =============================================================================

create table public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  -- hex SHA-256 of the full token; the token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- last characters of the token, so the user can tell keys apart.
  token_hint text not null check (char_length(token_hint) between 4 and 8),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.capture_tokens is
  'Personal keys for sending slips from an iPhone Shortcut. Hash only; a key can only add slips to its owner''s slip inbox.';

create index capture_tokens_user_idx on public.capture_tokens (user_id);

create trigger set_capture_tokens_updated_at
  before update on public.capture_tokens
  for each row execute function public.set_updated_at();

alter table public.capture_tokens enable row level security;

create policy "capture_tokens_select_own" on public.capture_tokens
  for select using (user_id = auth.uid());
create policy "capture_tokens_insert_own" on public.capture_tokens
  for insert with check (user_id = auth.uid());
create policy "capture_tokens_update_own" on public.capture_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "capture_tokens_delete_own" on public.capture_tokens
  for delete using (user_id = auth.uid());

-- -----------------------------------------------------------------------------

create table public.slip_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- pending   — waiting for the user
  -- confirmed — saved as a transaction (transaction_id)
  -- dismissed — the user said "not this one"
  -- not_slip  — the image wasn't a payment slip (kept so it's never re-read)
  -- duplicate — same reference as a transaction already recorded
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'dismissed', 'not_slip', 'duplicate')),
  origin text not null check (origin in ('shortcut', 'upload')),
  amount numeric(18, 2) check (amount is null or amount > 0),
  slip_date date,
  slip_time text check (slip_time is null or slip_time ~ '^\d{1,2}:\d{2}$'),
  merchant text check (merchant is null or char_length(merchant) <= 120),
  payment_method text check (payment_method is null or char_length(payment_method) <= 60),
  reference text check (reference is null or char_length(reference) <= 80),
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  -- Same amount ±1 day + similar merchant as an existing transaction: shown
  -- as "may already be recorded", never silently dropped.
  possible_duplicate_of uuid references public.transactions(id) on delete set null,
  -- hex SHA-256 of the uploaded bytes: a Shortcut looking back a few days
  -- resends the same photos — those are skipped before any AI call.
  image_sha256 text check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  transaction_id uuid references public.transactions(id) on delete set null,
  token_id uuid references public.capture_tokens(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.slip_inbox is
  'Slips read from the iPhone Shortcut or a bulk upload, waiting for the user. Not transactions: nothing here affects a balance until confirmed.';

create index slip_inbox_user_status_idx on public.slip_inbox (user_id, status, created_at desc);
create unique index slip_inbox_user_reference_idx
  on public.slip_inbox (user_id, reference) where reference is not null;
create unique index slip_inbox_user_image_idx
  on public.slip_inbox (user_id, image_sha256) where image_sha256 is not null;

create trigger set_slip_inbox_updated_at
  before update on public.slip_inbox
  for each row execute function public.set_updated_at();

-- Every referenced row must belong to the same user (a foreign key alone
-- doesn't check ownership — same reasoning as 0013 / 0042). Categories may
-- also be system categories.
create or replace function public.check_slip_inbox_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and user_id = new.user_id
  ) then
    raise exception 'account_id must reference an account owned by the same user';
  end if;
  if new.category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = new.category_id and (c.is_system = true or c.user_id = new.user_id)
  ) then
    raise exception 'category_id must be a system category or one owned by the same user';
  end if;
  if new.transaction_id is not null and not exists (
    select 1 from public.transactions where id = new.transaction_id and user_id = new.user_id
  ) then
    raise exception 'transaction_id must reference a transaction owned by the same user';
  end if;
  if new.possible_duplicate_of is not null and not exists (
    select 1 from public.transactions where id = new.possible_duplicate_of and user_id = new.user_id
  ) then
    raise exception 'possible_duplicate_of must reference a transaction owned by the same user';
  end if;
  if new.token_id is not null and not exists (
    select 1 from public.capture_tokens where id = new.token_id and user_id = new.user_id
  ) then
    raise exception 'token_id must reference a capture token owned by the same user';
  end if;
  return new;
end;
$$;

create trigger check_slip_inbox_ownership_trg
  before insert or update of user_id, account_id, category_id, transaction_id, possible_duplicate_of, token_id
  on public.slip_inbox
  for each row execute function public.check_slip_inbox_ownership();

alter table public.slip_inbox enable row level security;

create policy "slip_inbox_select_own" on public.slip_inbox
  for select using (user_id = auth.uid());
create policy "slip_inbox_insert_own" on public.slip_inbox
  for insert with check (user_id = auth.uid());
create policy "slip_inbox_update_own" on public.slip_inbox
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "slip_inbox_delete_own" on public.slip_inbox
  for delete using (user_id = auth.uid());
