-- Expand Privacy Center to cover the rest of the app's sensitive surfaces.
-- Existing choices remain unchanged; new scopes are opt-in.

alter table public.account_privacy_settings
  add column protect_overview boolean not null default false,
  add column protect_activity boolean not null default false,
  add column protect_planning boolean not null default false,
  add column protect_insights boolean not null default false;

drop function public.get_account_privacy_state(text);

create function public.get_account_privacy_state(p_unlock_token text default null)
returns table (
  enabled boolean,
  protect_accounts boolean,
  protect_assets boolean,
  protect_overview boolean,
  protect_activity boolean,
  protect_planning boolean,
  protect_insights boolean,
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
set search_path = public, extensions, pg_temp
as $$
  select
    coalesce(s.enabled, false),
    coalesce(s.protect_accounts, true),
    coalesce(s.protect_assets, false),
    coalesce(s.protect_overview, false),
    coalesce(s.protect_activity, false),
    coalesce(s.protect_planning, false),
    coalesce(s.protect_insights, false),
    coalesce(s.display_style, 'blur'::text),
    s.custom_message,
    s.pin_hash is not null,
    not coalesce(s.enabled, false) or (
      p_unlock_token is not null
      and s.unlock_token_hash = encode(extensions.digest(p_unlock_token, 'sha256'), 'hex')
      and s.unlocked_until > now()
    ),
    s.unlocked_until,
    s.locked_until
  from (select auth.uid() as user_id) request_context
  left join public.account_privacy_settings s on s.user_id = request_context.user_id;
$$;

-- Keep older configure_account_privacy overloads during rolling deploys.
create function public.configure_account_privacy(
  p_enabled boolean,
  p_protect_accounts boolean,
  p_protect_assets boolean,
  p_protect_overview boolean,
  p_protect_activity boolean,
  p_protect_planning boolean,
  p_protect_insights boolean,
  p_display_style text,
  p_custom_message text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  existing public.account_privacy_settings%rowtype;
  normalized_message text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if p_enabled
    and not p_protect_accounts
    and not p_protect_assets
    and not p_protect_overview
    and not p_protect_activity
    and not p_protect_planning
    and not p_protect_insights then
    raise exception 'privacy_scope_required';
  end if;

  if p_display_style not in ('blur', 'unavailable', 'empty', 'custom') then
    raise exception 'invalid_display_style';
  end if;

  normalized_message := nullif(left(trim(coalesce(p_custom_message, '')), 80), '');
  select * into existing
  from public.account_privacy_settings
  where user_id = auth.uid()
  for update;

  if found and existing.pin_hash is not null then
    if p_pin is null or extensions.crypt(p_pin, existing.pin_hash) <> existing.pin_hash then
      raise exception 'invalid_pin';
    end if;
  elsif p_enabled then
    if p_pin is null or p_pin !~ '^[0-9]{6}$' then
      raise exception 'pin_must_be_six_digits';
    end if;
  end if;

  insert into public.account_privacy_settings (
    user_id, enabled, protect_accounts, protect_assets, protect_overview,
    protect_activity, protect_planning, protect_insights, display_style,
    custom_message, pin_hash
  ) values (
    auth.uid(), p_enabled, p_protect_accounts, p_protect_assets,
    p_protect_overview, p_protect_activity, p_protect_planning,
    p_protect_insights, p_display_style, normalized_message,
    case when p_enabled then extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) else null end
  )
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    protect_accounts = excluded.protect_accounts,
    protect_assets = excluded.protect_assets,
    protect_overview = excluded.protect_overview,
    protect_activity = excluded.protect_activity,
    protect_planning = excluded.protect_planning,
    protect_insights = excluded.protect_insights,
    display_style = excluded.display_style,
    custom_message = excluded.custom_message,
    pin_hash = coalesce(public.account_privacy_settings.pin_hash, excluded.pin_hash),
    unlock_token_hash = null,
    unlocked_until = null,
    failed_attempts = 0,
    locked_until = null;
end;
$$;

revoke all on function public.get_account_privacy_state(text) from public;
revoke all on function public.configure_account_privacy(boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text) from public;
grant execute on function public.get_account_privacy_state(text) to authenticated;
grant execute on function public.configure_account_privacy(boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text) to authenticated;

notify pgrst, 'reload schema';
