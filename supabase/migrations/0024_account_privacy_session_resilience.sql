-- Make the privacy-state read resilient to a temporarily missing auth.uid().
-- The web layer still verifies the user before this RPC, but a SQL function
-- should return a safe default rather than crashing the entire Accounts page
-- if a request arrives while the auth token is being refreshed.

create or replace function public.get_account_privacy_state(p_unlock_token text default null)
returns table (
  enabled boolean,
  display_style text,
  custom_message text,
  pin_configured boolean,
  is_unlocked boolean,
  unlocked_until timestamptz,
  locked_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(s.enabled, false),
    coalesce(s.display_style, 'blur'::text),
    s.custom_message,
    s.pin_hash is not null,
    not coalesce(s.enabled, false) or (
      p_unlock_token is not null
      and s.unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex')
      and s.unlocked_until > now()
    ),
    s.unlocked_until,
    s.locked_until
  from (select auth.uid() as user_id) request_context
  left join public.account_privacy_settings s on s.user_id = request_context.user_id;
$$;

revoke all on function public.get_account_privacy_state(text) from public;
grant execute on function public.get_account_privacy_state(text) to authenticated;

-- Ensure PostgREST notices the replaced function immediately after db push.
notify pgrst, 'reload schema';
