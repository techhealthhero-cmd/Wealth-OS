-- Phase 6: Statement / CSV Import V1
--
-- Import batches and rows are staging/audit records only. Actual money
-- continues to live exclusively in public.transactions. Confirmation and
-- rollback are centralized in SECURITY INVOKER RPCs so existing transaction
-- RLS and account-balance triggers remain the final authority.

create table public.transaction_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  filename text not null check (char_length(filename) between 1 and 180),
  content_hash text not null check (char_length(content_hash) = 64),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'confirmed', 'rolled_back')),
  header_mapping jsonb not null default '{}'::jsonb,
  row_count integer not null default 0 check (row_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  confirmed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index transaction_import_batches_user_created_idx
  on public.transaction_import_batches (user_id, created_at desc);
create index transaction_import_batches_account_idx
  on public.transaction_import_batches (account_id);

create trigger set_transaction_import_batches_updated_at
  before update on public.transaction_import_batches
  for each row execute function public.set_updated_at();

create table public.transaction_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null,
  normalized_data jsonb,
  status text not null default 'pending'
    check (status in (
      'pending', 'ready', 'needs_review', 'duplicate', 'error',
      'imported', 'skipped', 'rolled_back'
    )),
  error_code text,
  fingerprint text,
  existing_transaction_id uuid references public.transactions(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_import_rows_batch_owner_fk
    foreign key (batch_id, user_id)
    references public.transaction_import_batches(id, user_id)
    on delete cascade,
  unique (batch_id, row_number)
);

create index transaction_import_rows_batch_status_idx
  on public.transaction_import_rows (batch_id, status, row_number);
create index transaction_import_rows_user_fingerprint_idx
  on public.transaction_import_rows (user_id, fingerprint)
  where fingerprint is not null;
create index transaction_import_rows_transaction_idx
  on public.transaction_import_rows (transaction_id)
  where transaction_id is not null;

create trigger set_transaction_import_rows_updated_at
  before update on public.transaction_import_rows
  for each row execute function public.set_updated_at();

alter table public.transaction_import_batches enable row level security;
alter table public.transaction_import_rows enable row level security;

create policy "transaction_import_batches_select_own"
  on public.transaction_import_batches for select
  using (user_id = auth.uid());

create policy "transaction_import_batches_insert_own"
  on public.transaction_import_batches for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid() and not a.is_archived
    )
  );

create policy "transaction_import_batches_update_own"
  on public.transaction_import_batches for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = auth.uid() and not a.is_archived
    )
  );

create policy "transaction_import_batches_delete_own"
  on public.transaction_import_batches for delete
  using (user_id = auth.uid() and status in ('draft', 'ready', 'rolled_back'));

create policy "transaction_import_rows_select_own"
  on public.transaction_import_rows for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.transaction_import_batches b
      where b.id = batch_id and b.user_id = auth.uid()
    )
  );

create policy "transaction_import_rows_insert_own"
  on public.transaction_import_rows for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.transaction_import_batches b
      where b.id = batch_id and b.user_id = auth.uid() and b.status = 'draft'
    )
  );

create policy "transaction_import_rows_update_own"
  on public.transaction_import_rows for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.transaction_import_batches b
      where b.id = batch_id and b.user_id = auth.uid()
    )
    and (
      transaction_id is null or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = auth.uid()
      )
    )
    and (
      existing_transaction_id is null or exists (
        select 1 from public.transactions t
        where t.id = existing_transaction_id and t.user_id = auth.uid()
      )
    )
  );

create policy "transaction_import_rows_delete_own"
  on public.transaction_import_rows for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.transaction_import_batches b
      where b.id = batch_id and b.user_id = auth.uid() and b.status in ('draft', 'ready', 'rolled_back')
    )
  );

-- Confirm every eligible row in one database transaction. Row IDs are used
-- as transaction client_request_id values, making retries idempotent through
-- the existing transactions_user_client_request_id_idx unique index.
create or replace function public.confirm_statement_import(p_batch_id uuid)
returns table (
  imported_count integer,
  skipped_count integer,
  review_count integer,
  error_count integer
)
language plpgsql
as $$
declare
  v_batch public.transaction_import_batches;
  v_row public.transaction_import_rows;
  v_transaction_id uuid;
  v_account_currency text;
begin
  select * into v_batch
  from public.transaction_import_batches
  where id = p_batch_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'import batch not found';
  end if;

  if v_batch.status = 'rolled_back' then
    raise exception 'rolled back import cannot be confirmed';
  end if;

  if v_batch.status = 'confirmed' then
    return query select
      v_batch.imported_count,
      v_batch.skipped_count,
      v_batch.review_count,
      v_batch.error_count;
    return;
  end if;

  select a.currency_code into v_account_currency
  from public.accounts a
  where a.id = v_batch.account_id and a.user_id = auth.uid() and not a.is_archived;

  if v_account_currency is null then
    raise exception 'target account is unavailable';
  end if;

  -- Duplicates are deliberately skipped unless a future explicit override
  -- flow changes the row back to ready after user review.
  update public.transaction_import_rows
  set status = 'skipped'
  where batch_id = p_batch_id and user_id = auth.uid() and status = 'duplicate';

  for v_row in
    select * from public.transaction_import_rows
    where batch_id = p_batch_id
      and user_id = auth.uid()
      and status in ('ready', 'needs_review')
    order by row_number
    for update
  loop
    if v_row.normalized_data is null then
      raise exception 'normalized import row is missing';
    end if;

    if coalesce(v_row.normalized_data ->> 'type', '') not in ('income', 'expense') then
      raise exception 'invalid imported transaction type';
    end if;
    if coalesce((v_row.normalized_data ->> 'amount')::numeric, 0) <= 0 then
      raise exception 'invalid imported transaction amount';
    end if;
    if coalesce(v_row.normalized_data ->> 'currencyCode', '') <> v_account_currency then
      raise exception 'import currency does not match target account';
    end if;
    if nullif(v_row.normalized_data ->> 'categoryId', '') is not null
       and not exists (
         select 1 from public.categories c
         where c.id = (v_row.normalized_data ->> 'categoryId')::uuid
           and (c.is_system or c.user_id = auth.uid())
       ) then
      raise exception 'invalid imported transaction category';
    end if;

    v_transaction_id := null;
    insert into public.transactions (
      user_id, account_id, category_id, type, amount, currency_code,
      transaction_date, description, merchant, source, client_request_id,
      review_status, ai_confidence, reference
    ) values (
      auth.uid(),
      v_batch.account_id,
      nullif(v_row.normalized_data ->> 'categoryId', '')::uuid,
      v_row.normalized_data ->> 'type',
      (v_row.normalized_data ->> 'amount')::numeric,
      v_row.normalized_data ->> 'currencyCode',
      (v_row.normalized_data ->> 'date')::date,
      nullif(v_row.normalized_data ->> 'description', ''),
      nullif(v_row.normalized_data ->> 'merchant', ''),
      'import',
      v_row.id,
      case when v_row.status = 'needs_review' then 'needs_review' else 'confirmed' end,
      case when v_row.status = 'needs_review' then 'medium' else 'high' end,
      nullif(v_row.normalized_data ->> 'reference', '')
    )
    on conflict (user_id, client_request_id) where client_request_id is not null
    do nothing
    returning id into v_transaction_id;

    if v_transaction_id is null then
      select id into v_transaction_id
      from public.transactions
      where user_id = auth.uid() and client_request_id = v_row.id;
    end if;

    update public.transaction_import_rows
    set status = 'imported', transaction_id = v_transaction_id
    where id = v_row.id and user_id = auth.uid();
  end loop;

  select
    count(*) filter (where status = 'imported')::integer,
    count(*) filter (where status = 'skipped')::integer,
    count(*) filter (
      where status = 'imported'
        and coalesce(normalized_data ->> 'reviewRequired', 'false') = 'true'
    )::integer,
    count(*) filter (where status = 'error')::integer
  into imported_count, skipped_count, review_count, error_count
  from public.transaction_import_rows
  where batch_id = p_batch_id and user_id = auth.uid();

  update public.transaction_import_batches
  set status = 'confirmed',
      imported_count = confirm_statement_import.imported_count,
      skipped_count = confirm_statement_import.skipped_count,
      review_count = confirm_statement_import.review_count,
      error_count = confirm_statement_import.error_count,
      confirmed_at = coalesce(confirmed_at, now())
  where id = p_batch_id and user_id = auth.uid();

  return next;
end;
$$;

-- Rollback is intentionally narrow: only transaction IDs linked from rows
-- in this owned batch, still marked source=import, are deleted. Existing
-- balance triggers recompute every affected account after each delete.
create or replace function public.rollback_statement_import(p_batch_id uuid)
returns integer
language plpgsql
as $$
declare
  v_batch public.transaction_import_batches;
  v_deleted integer := 0;
begin
  select * into v_batch
  from public.transaction_import_batches
  where id = p_batch_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'import batch not found';
  end if;

  if v_batch.status = 'rolled_back' then
    return 0;
  end if;

  if v_batch.status <> 'confirmed' then
    raise exception 'only a confirmed import can be rolled back';
  end if;

  delete from public.transactions t
  using public.transaction_import_rows r
  where r.batch_id = p_batch_id
    and r.user_id = auth.uid()
    and r.transaction_id = t.id
    and t.user_id = auth.uid()
    and t.source = 'import'
    and t.client_request_id = r.id;
  get diagnostics v_deleted = row_count;

  update public.transaction_import_rows
  set status = case when status = 'imported' then 'rolled_back' else status end,
      normalized_data = case
        when transaction_id is not null then
          jsonb_set(normalized_data, '{rolledBackTransactionId}', to_jsonb(transaction_id::text), true)
        else normalized_data
      end,
      transaction_id = null
  where batch_id = p_batch_id and user_id = auth.uid();

  update public.transaction_import_batches
  set status = 'rolled_back', rolled_back_at = now()
  where id = p_batch_id and user_id = auth.uid();

  return v_deleted;
end;
$$;

revoke all on function public.confirm_statement_import(uuid) from public;
revoke all on function public.rollback_statement_import(uuid) from public;
grant execute on function public.confirm_statement_import(uuid) to authenticated;
grant execute on function public.rollback_statement_import(uuid) to authenticated;
