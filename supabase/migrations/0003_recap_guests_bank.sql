-- ============================================================================
-- Tallyho 0003 — answer-only guests + global question bank
--
-- Additive and backward-safe. Run once in the Supabase SQL editor.
--
--   (1) members.is_playing — "answer-only" people: friends you want pickable as
--       answers but who won't be at game night. is_playing=false means they
--       never join, get a team, fill out, or take a turn — but their name is a
--       selectable option on pick-a-person questions.
--
--   (2) question_bank — every authored question, across all groups, so the
--       recommender can learn which prompts resonate. Service-role only (RLS on
--       with no policies = denied to anon/owner clients; server routes use the
--       service-role key).
--
-- The end-of-game recap is stored under games.state.recap (jsonb), so it needs
-- no schema change.
-- ============================================================================

alter table public.members
  add column if not exists is_playing boolean not null default true;

create table if not exists public.question_bank (
  id                uuid primary key default gen_random_uuid(),
  prompt            text not null,
  normalized_prompt text not null,
  type              text not null,
  category          text,
  options           jsonb,
  source_group_id   uuid,                 -- no FK: survives group deletion
  times_used        int  not null default 1,
  resonance         numeric,              -- avg top-bucket fraction when played (0..1)
  resonance_samples int  not null default 0,
  play_count        int  not null default 0,
  last_used_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create unique index if not exists question_bank_norm_idx
  on public.question_bank (normalized_prompt, type);
create index if not exists question_bank_category_idx
  on public.question_bank (category);

alter table public.question_bank enable row level security;
-- No policies on purpose: only the service role (server routes/actions) touches
-- this table. RLS-with-no-policy denies all anon/authenticated access.
