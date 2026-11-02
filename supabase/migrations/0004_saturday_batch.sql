-- ============================================================================
-- Tallyho — "Saturday batch" schema changes (run once, in order after 0003)
--
-- Safe + additive: drops one overly-strict UNIQUE, adds nullable columns, and
-- creates one small table + a public Storage bucket for team logos. Nothing is
-- deleted, and the CURRENT app keeps working unchanged after you run it.
-- Paste into the Supabase SQL editor and run.
-- ============================================================================

-- 1) HOLDOUTS: allow a member to be the live "holdout" for MORE THAN ONE
--    question. With e.g. 40 questions and 20 players we now hold out ~2 each so
--    every authored question gets played (and each player answers the rest).
--    A question is still held out for at most ONE player (the other unique stays).
alter table public.feud_question_assignments
  drop constraint if exists feud_question_assignments_group_id_member_id_key;

-- 2) TEAM BRANDING: captains can upload a logo/photo (shown in the live game).
alter table public.teams
  add column if not exists logo_url text,
  add column if not exists emoji    text;   -- optional fallback badge if no logo

-- 3) SCHEDULING: host sets the game date + an answer deadline (shown to members).
--    (groups.scheduled_time already exists — we use it as the game date and add
--     the answer deadline here.)
alter table public.groups
  add column if not exists answer_deadline  timestamptz,
  -- Host-chosen trivia categories (incl. custom "company trivia"). NULL = the
  -- built-in 5. Shape: [{"name":"Sports","custom":false}, {"name":"Acme Inc","custom":true}]
  add column if not exists trivia_categories jsonb;

-- 4) TRIVIA LEARNING: when the host flags a question as too easy/obvious during
--    the game (or in the editor), we log it so future generation can avoid it.
create table if not exists public.trivia_feedback (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid references public.groups (id) on delete cascade,
  question_id       uuid,                         -- may be gone later; kept loose on purpose
  prompt            text not null,
  normalized_prompt text not null,                -- lowercased/trimmed for matching
  correct_answer    text,
  reason            text not null default 'too_obvious',
  created_at        timestamptz not null default now()
);
create index if not exists trivia_feedback_group_idx on public.trivia_feedback (group_id);
create index if not exists trivia_feedback_norm_idx  on public.trivia_feedback (normalized_prompt);

-- trivia_feedback is service-role-only (like question_bank): RLS on, no policies.
alter table public.trivia_feedback enable row level security;

-- 5) TEAM-LOGO STORAGE: a PUBLIC bucket so uploaded logos can be <img>-displayed.
--    Uploads happen through the service-role server route, so we only need a
--    public READ policy here (service role bypasses RLS for writes).
insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do update set public = true;

drop policy if exists "team-logos public read" on storage.objects;
create policy "team-logos public read"
  on storage.objects for select
  using (bucket_id = 'team-logos');
