-- Create the staging batch and its raw rows atomically. This closes the gap
-- where a completed batch insert followed by a separate rows request could
-- leave an orphan batch (or observe an auth/session transition between the
-- two requests). SECURITY INVOKER keeps every RLS policy active.
create or replace function public.create_statement_import_batch(
  p_account_id uuid,
  p_filename text,
  p_content_hash text,
  p_rows jsonb
)
returns public.transaction_import_batches
language plpgsql
as $$
declare
  v_batch public.transaction_import_batches;
  v_row_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1 from public.accounts a
    where a.id = p_account_id and a.user_id = auth.uid() and not a.is_archived
  ) then
    raise exception 'target account is unavailable';
  end if;
  if char_length(p_filename) not between 1 and 180 then
    raise exception 'invalid filename';
  end if;
  if p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid content hash';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array';
  end if;

  v_row_count := jsonb_array_length(p_rows);
  if v_row_count < 1 or v_row_count > 2000 then
    raise exception 'invalid row count';
  end if;

  insert into public.transaction_import_batches (
    user_id, account_id, filename, content_hash, row_count
  ) values (
    auth.uid(), p_account_id, p_filename, p_content_hash, v_row_count
  ) returning * into v_batch;

  insert into public.transaction_import_rows (
    batch_id, user_id, row_number, raw_data
  )
  select
    v_batch.id,
    auth.uid(),
    item.ordinality::integer,
    item.value
  from jsonb_array_elements(p_rows) with ordinality as item(value, ordinality);

  return v_batch;
end;
$$;

revoke all on function public.create_statement_import_batch(uuid, text, text, jsonb) from public;
grant execute on function public.create_statement_import_batch(uuid, text, text, jsonb) to authenticated;
