# Tallyho — dress-rehearsal testing

A repeatable way to pressure-test a group before a real event: clone the real
group, bulk-fill every player's answers as if they'd all filled out their phones,
then host a live game "day-of" and watch it run — all without touching the real
group's data.

## The harness

`scripts/tally-test.mjs` (plain Node, no deps — reads Supabase keys from `.env.local`):

```bash
node scripts/tally-test.mjs list                               # all groups + join codes
node scripts/tally-test.mjs clone "Conner Clan" "Conner Clan TEST"   # copy roster/teams/captains/questions
node scripts/tally-test.mjs fill  "Conner Clan TEST"           # bulk-answer everyone + pick captain topics
node scripts/tally-test.mjs status "Conner Clan TEST"          # readiness board (who answered, holdouts, trivia)
node scripts/tally-test.mjs reset "Conner Clan TEST"           # wipe answers/trivia/games, keep the setup
node scripts/tally-test.mjs teardown "Conner Clan TEST"        # delete the test group entirely
node scripts/tally-test.mjs make "Test Crew" --members 8 --teams 2   # fresh synthetic group from scratch
```

`fill` guarantees each player a distinct holdout question, answers every *other*
question for them with a clear plurality (so the "[Group] says…" reveal shows a
clean top answer), and has both captains pick one topic per category.

## The process

1. **Set up the real event** in the app (roster, teams, captains, feud questions).
   Captains can pick topics now or later; members do *not* need to have filled out.
2. **Clone + fill** it into a test twin (commands above). The real group is never modified.
3. **Host it day-of** — this is the real test:
   - Open the test group in your dashboard → click **⚡ Generate trivia bank** (tests that path) → **▶ Host live game**.
   - Walk the whole loop: pre-game topic screen → feud guess + reveal → trivia + reveal → scores → **Play another round** (confirm round 2 gets *different* feud questions and a *fresh* trivia bank).
   - Try the host overrides: fix a fuzzy-match dispute on a feud reveal, toggle a trivia answer right/wrong.
4. **Feel the member side** (optional, 2 min): open the test join link on your phone,
   pick a name, answer a couple questions, and (as a captain) pick topics — this is the
   exact experience your crew gets.
5. **Report anything rough** and iterate. `reset` to re-run a clean pass, or `teardown` when done.

Test twin for the current rehearsal: **Conner Clan TEST**, join code `9CDD8F`.
