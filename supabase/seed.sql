-- =============================================================================
-- WEALTH OS — local development seed data
--
-- Runs automatically on `supabase db reset` / `supabase start` against your
-- LOCAL Supabase instance only. Never run this against a production project
-- — it creates a demo auth user with a fixed, publicly-known password.
--
-- Demo login: demo@wealthos.local / wealthos-demo-password
-- =============================================================================

do $$
declare
  v_demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_cash_account_id uuid := '00000000-0000-0000-0000-0000000000a1';
  v_bank_account_id uuid := '00000000-0000-0000-0000-0000000000a2';
  v_salary_cat_id uuid;
  v_food_cat_id uuid;
  v_transport_cat_id uuid;
  v_housing_cat_id uuid;
  v_subscriptions_cat_id uuid;
  v_other_expense_cat_id uuid;
begin
  -- Demo auth user (local dev only — Supabase's local Postgres allows direct
  -- writes to auth.users; this would not work against hosted Supabase).
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_demo_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo@wealthos.local',
    crypt('wealthos-demo-password', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo User"}'
  )
  on conflict (id) do nothing;

  -- handle_new_user() trigger already created a profile; make sure onboarding
  -- shows as complete for the demo account.
  update public.profiles
  set onboarding_completed = true, display_name = 'Demo User'
  where user_id = v_demo_user_id;

  -- Demo accounts: Cash ฿5,000 and Bank (SCB) ฿75,000, per the Day-1 spec.
  insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance)
  values
    (v_cash_account_id, v_demo_user_id, 'Cash', 'cash', null, 'THB', 5000.00),
    (v_bank_account_id, v_demo_user_id, 'SCB', 'bank', 'Siam Commercial Bank', 'THB', 75000.00)
  on conflict (id) do nothing;

  select id into v_salary_cat_id from public.categories where is_system and name_en = 'Salary';
  select id into v_food_cat_id from public.categories where is_system and name_en = 'Food & Dining';
  select id into v_transport_cat_id from public.categories where is_system and name_en = 'Transport';
  select id into v_housing_cat_id from public.categories where is_system and name_en = 'Housing';
  select id into v_subscriptions_cat_id from public.categories where is_system and name_en = 'Subscriptions';
  select id into v_other_expense_cat_id from public.categories where is_system and name_en = 'Other' and type = 'expense';

  -- Demo transactions for the current month, matching the Step 25 example.
  insert into public.transactions (
    user_id, account_id, category_id, type, amount, transaction_date, description, merchant, source
  ) values
    (v_demo_user_id, v_bank_account_id, v_salary_cat_id, 'income', 40000.00, date_trunc('month', current_date)::date + 0, 'Monthly salary', 'Employer', 'seed'),
    (v_demo_user_id, v_cash_account_id, v_food_cat_id, 'expense', 6500.00, date_trunc('month', current_date)::date + 4, 'Groceries and dining', null, 'seed'),
    (v_demo_user_id, v_cash_account_id, v_transport_cat_id, 'expense', 3000.00, date_trunc('month', current_date)::date + 5, 'BTS and taxi', null, 'seed'),
    (v_demo_user_id, v_bank_account_id, v_housing_cat_id, 'expense', 8000.00, date_trunc('month', current_date)::date + 1, 'Monthly rent', 'Landlord', 'seed'),
    (v_demo_user_id, v_bank_account_id, v_subscriptions_cat_id, 'expense', 1200.00, date_trunc('month', current_date)::date + 2, 'Streaming subscriptions', null, 'seed'),
    (v_demo_user_id, v_cash_account_id, v_other_expense_cat_id, 'expense', 5000.00, date_trunc('month', current_date)::date + 8, 'Miscellaneous', null, 'seed');

  -- Demo transfer: moving some cash into the bank account. Must not affect
  -- income/expense/cash-flow totals. Inserted directly (rather than via the
  -- create_transfer() RPC) because this script runs with no authenticated
  -- session, and the RPC's ownership checks rely on auth.uid().
  insert into public.transactions (
    user_id, type, amount, transaction_date, description, from_account_id, to_account_id, source
  ) values (
    v_demo_user_id, 'transfer', 2000.00, date_trunc('month', current_date)::date + 10,
    'Move cash to savings', v_cash_account_id, v_bank_account_id, 'seed'
  );
end $$;
