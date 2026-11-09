-- ============================================================================
-- 0006 — Feud subject (themed answer pools)
--
-- Lets a host choose what pick-a-person questions are answered FROM:
--   • group mode (default, null)       — the people in the group
--   • theme mode { mode, theme, pool }  — a fixed list (athletes, Disney, custom)
--
-- jsonb shape when themed:
--   { "mode": "theme", "theme": "Athletes", "pool": ["LeBron James", ...] }
-- Null / absent = group mode, so existing groups keep their current behavior.
-- Safe to run more than once.
-- ============================================================================

begin;

alter table public.groups
  add column if not exists feud_subject jsonb;

comment on column public.groups.feud_subject is
  'Pick-a-person answer pool. null = group members; {mode:"theme",theme,pool} = themed list.';

commit;
