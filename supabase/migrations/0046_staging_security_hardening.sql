-- Staging security hardening (0046). Staging project only.
-- Keep login rate-limit callable by anon; revoke unsafe helper EXECUTE from anon/public as needed.
-- Fix mutable search_path on listed INVOKER helpers; relocate pg_trgm to extensions.

begin;
-- Internal trigger/helper routines: not public client RPCs.
revoke execute on function
  public.check_account_alias_ownership(),
  public.check_capture_unit_category_ownership(),
  public.check_liability_linked_account_ownership(),
  public.check_merchant_account_pref_ownership(),
  public.check_merchant_pref_category_ownership(),
  public.handle_new_user(),
  public.recalc_account_balance(uuid),
  public.trg_recalc_account_balances(),
  public.trg_recalc_on_opening_balance_change()
from public, anon, authenticated;

-- Keep privacy APIs authenticated-only, including all three overloads.
revoke execute on function
  public.configure_account_privacy(boolean, text, text, text),
  public.configure_account_privacy(boolean, boolean, boolean, text, text, text),
  public.configure_account_privacy(boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text),
  public.get_account_privacy_state(text),
  public.lock_account_privacy(),
  public.unlock_account_privacy(text, text)
from public, anon;

grant execute on function
  public.configure_account_privacy(boolean, text, text, text),
  public.configure_account_privacy(boolean, boolean, boolean, text, text, text),
  public.configure_account_privacy(boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, text),
  public.get_account_privacy_state(text),
  public.lock_account_privacy(),
  public.unlock_account_privacy(text, text)
to authenticated;

-- Preserve login/signup throttling before a session exists.
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to anon, authenticated;

alter function public.set_updated_at() set search_path = '';
alter function public.set_account_current_balance() set search_path = '';
alter function public.create_transfer(uuid, uuid, numeric, date, text, text, uuid) set search_path = '';
alter function public.update_transfer(uuid, uuid, uuid, numeric, date, text, text) set search_path = '';
alter function public.confirm_statement_import(uuid) set search_path = '';
alter function public.rollback_statement_import(uuid) set search_path = '';
alter function public.create_statement_import_batch(uuid, text, text, jsonb) set search_path = '';

-- Relocate only from the reviewed source schema; abort on unexpected state.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'extensions') then
    raise exception '0046 requires the existing extensions schema';
  end if;
  if not exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and e.extrelocatable
      and n.nspname in ('public', 'extensions')
  ) then
    raise exception '0046 requires relocatable pg_trgm in public or extensions';
  end if;
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'public'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end;
$$;
commit;
