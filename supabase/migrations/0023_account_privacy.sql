-- Account privacy / shoulder-surfing protection.
--
-- The settings table intentionally has RLS enabled with no direct client
-- policies. All reads and writes go through the narrow SECURITY DEFINER
-- functions below, so the PIN hash and unlock-token hash can never be
-- selected through the public API.

create table public.account_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  display_style text not null default 'blur'
    check (display_style in ('blur', 'unavailable', 'empty', 'custom')),
  custom_message text
    check (custom_message is null or char_length(custom_message) <= 80),
  pin_hash text,
  unlock_token_hash text,
  unlocked_until timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_privacy_settings enable row level security;

create trigger set_account_privacy_settings_updated_at
  before update on public.account_privacy_settings
  for each row execute function public.set_updated_at();

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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  return query
  select
    s.enabled,
    s.display_style,
    s.custom_message,
    s.pin_hash is not null,
    not s.enabled or (
      p_unlock_token is not null
      and s.unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex')
      and s.unlocked_until > now()
    ),
    s.unlocked_until,
    s.locked_until
  from public.account_privacy_settings s
  where s.user_id = auth.uid();

  if not found then
    return query select false, 'blur'::text, null::text, false, true, null::timestamptz, null::timestamptz;
  end if;
end;
$$;

create or replace function public.configure_account_privacy(
  p_enabled boolean,
  p_display_style text,
  p_custom_message text,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.account_privacy_settings%rowtype;
  normalized_message text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
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
    if p_pin is null or crypt(p_pin, existing.pin_hash) <> existing.pin_hash then
      raise exception 'invalid_pin';
    end if;
  elsif p_enabled then
    if p_pin is null or p_pin !~ '^[0-9]{6}$' then
      raise exception 'pin_must_be_six_digits';
    end if;
  end if;

  insert into public.account_privacy_settings (
    user_id,
    enabled,
    display_style,
    custom_message,
    pin_hash
  ) values (
    auth.uid(),
    p_enabled,
    p_display_style,
    normalized_message,
    case when p_enabled then crypt(p_pin, gen_salt('bf', 10)) else null end
  )
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    display_style = excluded.display_style,
    custom_message = excluded.custom_message,
    pin_hash = coalesce(public.account_privacy_settings.pin_hash, excluded.pin_hash),
    unlock_token_hash = null,
    unlocked_until = null,
    failed_attempts = 0,
    locked_until = null;
end;
$$;

create or replace function public.unlock_account_privacy(p_pin text, p_unlock_token text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  settings public.account_privacy_settings%rowtype;
  next_attempts integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select * into settings
  from public.account_privacy_settings
  where user_id = auth.uid()
  for update;

  if not found or not settings.enabled or settings.pin_hash is null then
    return 'not_configured';
  end if;

  if settings.locked_until is not null and settings.locked_until > now() then
    return 'temporarily_locked';
  end if;

  if crypt(p_pin, settings.pin_hash) = settings.pin_hash then
    update public.account_privacy_settings set
      unlock_token_hash = encode(digest(p_unlock_token, 'sha256'), 'hex'),
      unlocked_until = now() + interval '15 minutes',
      failed_attempts = 0,
      locked_until = null
    where user_id = auth.uid();
    return 'unlocked';
  end if;

  next_attempts := settings.failed_attempts + 1;
  update public.account_privacy_settings set
    failed_attempts = case when next_attempts >= 5 then 0 else next_attempts end,
    locked_until = case when next_attempts >= 5 then now() + interval '5 minutes' else null end,
    unlock_token_hash = null,
    unlocked_until = null
  where user_id = auth.uid();

  return case when next_attempts >= 5 then 'temporarily_locked' else 'invalid_pin' end;
end;
$$;

create or replace function public.lock_account_privacy()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.account_privacy_settings
  set unlock_token_hash = null, unlocked_until = null
  where user_id = auth.uid();
$$;

revoke all on function public.get_account_privacy_state(text) from public;
revoke all on function public.configure_account_privacy(boolean, text, text, text) from public;
revoke all on function public.unlock_account_privacy(text, text) from public;
revoke all on function public.lock_account_privacy() from public;

grant execute on function public.get_account_privacy_state(text) to authenticated;
grant execute on function public.configure_account_privacy(boolean, text, text, text) to authenticated;
grant execute on function public.unlock_account_privacy(text, text) to authenticated;
grant execute on function public.lock_account_privacy() to authenticated;
