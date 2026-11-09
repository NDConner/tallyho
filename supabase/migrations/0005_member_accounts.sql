-- 0005_member_accounts.sql
-- Give MEMBERS real identities.
--
-- Today a member is just a `members` row and "being" that member means knowing
-- the group's 6-char join code and picking the name off a public roster — the
-- only server check (validateMember) confirms the member belongs to the group,
-- never that the caller IS that member. So anyone with the code can read or
-- overwrite anyone's answers. This migration adds the schema needed to tie a
-- member row to a real auth.users account so a person can only ever touch their
-- own answers, with history across every game they were in.
--
-- The host-ownership RLS policies from 0001 are left exactly as they are; this
-- only ADDS member-scoped access (policies are OR-combined, so hosts keep full
-- access to their own groups and members get access to just their own data).
--
-- Safe to run more than once (idempotent).

begin;

-- 1) Member ↔ account link ---------------------------------------------------
alter table public.members
  add column if not exists user_id    uuid references auth.users (id) on delete set null,
  add column if not exists claim_email text,          -- optional: host reserves a slot for a specific email
  add column if not exists claimed_at  timestamptz;

comment on column public.members.user_id is
  'The auth.users account that has claimed this roster slot. NULL = unclaimed (legacy / not yet logged in).';
comment on column public.members.claim_email is
  'Optional: if set, only a user signed in with this email may claim the slot (host pre-assignment).';

-- One account holds at most one slot per group.
create unique index if not exists members_user_per_group
  on public.members (group_id, user_id) where user_id is not null;

-- Fast "every group/game I was in" lookup for a member's history page.
create index if not exists members_user_id_idx
  on public.members (user_id) where user_id is not null;

-- 2) Per-group switch: require members to be logged in + claimed --------------
--    Existing groups default to FALSE so nothing in flight breaks; the app opts
--    new groups in. When TRUE, the member routes reject unauthenticated callers.
alter table public.groups
  add column if not exists require_member_login boolean not null default false;

-- 3) Member-scoped RLS (additive to the host-ownership policies; defense in depth)
--    These let an authenticated member read their own member rows and read/write
--    only their own feud_responses even via a non-service-role client — so the
--    member history page can query directly, and a route bug can never expose or
--    let someone edit another person's answers.
drop policy if exists members_self_select on public.members;
create policy members_self_select on public.members
  for select using (user_id = auth.uid());

drop policy if exists feud_responses_member_rw on public.feud_responses;
create policy feud_responses_member_rw on public.feud_responses
  for all
  using (
    exists (
      select 1 from public.members m
      where m.id = feud_responses.member_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = feud_responses.member_id and m.user_id = auth.uid()
    )
  );

commit;
