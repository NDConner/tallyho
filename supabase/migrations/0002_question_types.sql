-- ============================================================================
-- Says Who? / Tallyho — question-type expansion
--
-- Adds the "guess_what" (solo-answer, e.g. FMK) target. Everything else the new
-- types need is derivable at play time, so this is the only schema change.
--
--   feud_questions.type gains two values (no CHECK constraint exists, so no DDL
--   is needed for them):
--     guess_who  — everyone answers a personal prompt; live, the team guesses
--                  WHO gave a shown answer. All-or-nothing.
--     guess_what — only target_member_id answers; live, the team guesses WHAT
--                  that person said. All-or-nothing.
-- ============================================================================

alter table public.feud_questions
  add column if not exists target_member_id uuid
  references public.members (id) on delete set null;

create index if not exists feud_questions_target_idx
  on public.feud_questions (target_member_id);
