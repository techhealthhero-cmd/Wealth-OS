-- =============================================================================
-- 0040 — Notebook cover preferences (Notebook Cover & Opening Experience).
--
-- Purely cosmetic, user-owned preferences, so they live on the existing
-- profiles row (like selected_companion_id, 0038) instead of a new table.
-- The existing profiles_*_own RLS policies already scope every read/write to
-- auth.uid(); nothing financial is touched.
--
-- Values are validated twice: here (shape/length, so a REST client can't
-- store junk) and by the server action's Zod schema (the exact catalogue in
-- src/lib/notebook-covers/config.ts). Theme/sticker ids are checked by
-- pattern rather than a fixed list on purpose: adding a cover later is a
-- config change, not a migration. The app falls back to the default cover
-- for any id it doesn't know.
--
-- Existing users get the default cover (forest) and cover_chosen_at = null;
-- they are never forced through the cover onboarding.
-- =============================================================================

alter table public.profiles
  add column cover_theme text not null default 'forest'
    check (cover_theme ~ '^[a-z0-9-]{1,32}$'),
  add column cover_decorations text[] not null default '{}'
    check (
      cardinality(cover_decorations) <= 3
      and array_to_string(cover_decorations, ',') ~ '^([a-z0-9-]{1,32}(,[a-z0-9-]{1,32})*)?$'
    ),
  add column cover_name text
    check (cover_name is null or char_length(cover_name) between 1 and 24),
  add column opening_animation_enabled boolean not null default true,
  add column cover_chosen_at timestamptz;

comment on column public.profiles.cover_theme is
  'Notebook cover theme id (see src/lib/notebook-covers/config.ts). Cosmetic only.';
comment on column public.profiles.cover_chosen_at is
  'When the user finished (or skipped) the cover onboarding step; null = never shown it.';
