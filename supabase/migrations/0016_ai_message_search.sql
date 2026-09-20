-- =============================================================================
-- WEALTH OS — Migration 0016: AI chat message search (Plus+ feature)
--
-- Supports "AI chat history + search" (CLAUDE.md-adjacent premium feature,
-- gated via FEATURES.AI_CHAT_HISTORY in src/lib/billing/plans.ts) — browsing
-- past ai_conversations already works with existing queries
-- (getConversations/getMessages, 0005_ai_money_coach.sql); this migration
-- adds the ability to search message CONTENT across a user's history.
--
-- Deliberately pg_trgm + a GIN index + `ilike`, NOT Postgres full-text search
-- (`tsvector`/`to_tsvector`): FTS's built-in language configs ('english',
-- 'simple') don't tokenize Thai text meaningfully (Thai has no whitespace
-- word boundaries), and this app's chat content is bilingual by design (see
-- CLAUDE.md "Primary language: Thai, Secondary language: English"). Trigram
-- matching via `ilike '%term%'` treats both languages identically and needs
-- no per-language configuration, at the cost of not supporting FTS features
-- (ranking, stemming) this feature doesn't need — a simple substring search
-- over a user's own message history.
-- =============================================================================
create extension if not exists pg_trgm;

create index ai_messages_content_trgm_idx on public.ai_messages using gin (content gin_trgm_ops);
