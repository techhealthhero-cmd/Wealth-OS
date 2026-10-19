-- PROPOSAL — NOT APPLIED — needs user approval; rename into supabase/migrations with the next free number when approved
-- Additive, nullable metadata only. No RLS, policy, grant, auth or data changes.
alter table public.assets
  add column category_group text check (category_group in ('cash_deposits', 'market_investments', 'insurance_savings', 'precious_metals', 'digital_assets', 'real_estate', 'land_vehicles', 'special_vehicles', 'heavy_machinery', 'livestock_pets', 'tools_materials', 'creator_equipment', 'musical_instruments', 'it_electronics', 'home_appliances', 'luxury_fashion', 'watches', 'jewelry', 'collectibles', 'amulets', 'art_antiques', 'hobbies_sports', 'firearms', 'business_inventory', 'receivables_claims', 'custom')),
  add column subcategory text,
  add column purchase_price numeric(18,2),
  add column purchase_date date,
  add column valuation_mode text check (valuation_mode in ('declining', 'compound', 'market', 'fixed')),
  add column depreciation_rate numeric(7,3),
  add column value_floor_pct numeric(5,2),
  add column market_value numeric(18,2),
  add column market_value_updated_at timestamptz,
  add column tags text[];
comment on column public.assets.depreciation_rate is 'User override percent per year: positive loses value, negative gains. Estimates, never guarantees.';

alter table public.liabilities
  add column term_months int,
  add column interest_rate_period text check (interest_rate_period in ('month', 'year')),
  add column start_date date;
-- interest_rate remains the existing ANNUAL percentage, irrespective of the input period.

alter table public.recurring_transactions
  add column liability_id uuid references public.liabilities(id) on delete set null;
create index recurring_transactions_liability_id_idx on public.recurring_transactions(liability_id);
comment on column public.recurring_transactions.liability_id is 'Proposal: an ownership-check trigger like other cross-row FKs may be needed before use; FK alone does not enforce same-user ownership.';
