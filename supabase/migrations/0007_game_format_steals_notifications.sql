-- ============================================================================
-- 0007 — Game format + steals + notifications
--
-- Covers three features:
--   1. Feud + trivia MIX  — groups.feud_ratio (% feud; 100 = feud only) and
--      groups.trivia_picker ('captains' | 'host').
--   2. Steal mode         — groups.steals_enabled: if a team misses, the next
--      team can steal for +1.
--   3. Returning players + notifications — an in-app notifications inbox so a
--      player is pinged when a host adds them to a game.
--
-- All additive and safe to run more than once. Existing groups keep today's
-- behavior (even feud/trivia split, captains pick topics, no steals).
-- ============================================================================

begin;

-- 1 + 2) group-level game settings
alter table public.groups add column if not exists feud_ratio     int     not null default 50;
alter table public.groups add column if not exists trivia_picker  text    not null default 'captains';
alter table public.groups add column if not exists steals_enabled boolean not null default false;

comment on column public.groups.feud_ratio is '% of the live game that is feud vs trivia (100 = feud only).';
comment on column public.groups.trivia_picker is 'Who picks trivia topics: captains | host.';
comment on column public.groups.steals_enabled is 'If true, a missed question can be stolen by the next team for +1.';

-- 3) in-app notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null,                       -- added_to_game | ...
  title      text not null,
  body       text,
  link       text,                                -- where it points (e.g. /join?code=XXYYZZ)
  group_id   uuid references public.groups (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- A person can read and update (mark read) only their own notifications. The
-- server (service role) creates them and bypasses RLS.
drop policy if exists notifications_self_select on public.notifications;
create policy notifications_self_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
