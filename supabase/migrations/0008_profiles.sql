-- ============================================================================
-- 0008 — User profiles (demographics / master data)
--
-- Optional demographic data captured at sign-up (and editable on /me), for
-- consumer-trend analysis and the admin console. One row per auth user.
-- Each person reads/writes only their own row; the admin console reads all via
-- the service role (which bypasses RLS).
-- ============================================================================

begin;

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text,
  full_name  text,
  age_range  text,          -- "18–24", "25–34", …
  gender     text,          -- "Male" | "Female" | "Prefer not to say"
  location   text,          -- free text (city / region / country)
  interests  text,          -- comma-separated
  occupation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (user_id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
