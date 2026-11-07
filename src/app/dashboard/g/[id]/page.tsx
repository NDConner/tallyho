import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/brand";
import { memberInvite, captainInvite, joinLink } from "@/lib/invites";
import { InviteCard } from "@/components/InviteCard";
import { CopyButton } from "@/components/CopyButton";
import { RosterEditor } from "@/components/RosterEditor";
import { GroupAdmin } from "@/components/GroupAdmin";
import { GameLengthControl } from "@/components/GameLengthControl";
import { GameSchedule } from "@/components/GameSchedule";
import { addMember, generateTriviaBank, reshuffleTeams, addGuest, removeMember, setAnswerLock } from "./actions";
import type { Group, Member, Team } from "@/lib/types";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groupData } = await supabase.from("groups").select("*").eq("id", id).single();
  if (!groupData) notFound();
  const group = groupData as Group;

  const [
    { data: memberData },
    { data: teamData },
    { count: topicCount },
    { count: assignCount },
    { count: triviaCount },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("group_id", id).order("created_at"),
    supabase.from("teams").select("*").eq("group_id", id).order("team_index"),
    supabase
      .from("trivia_topics")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id)
      .eq("selected", true),
    supabase
      .from("feud_question_assignments")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id),
    supabase
      .from("trivia_questions")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id),
  ]);
  const members = (memberData ?? []) as Member[];
  const teams = (teamData ?? []) as Team[];
  // Players take turns & fill out; "answer-only" guests are just pickable names.
  const players = members.filter((m) => m.is_playing !== false);
  const guests = members.filter((m) => m.is_playing === false);

  // Most recent game (for the end-of-game recap link).
  const { data: latestGame } = await supabase
    .from("games")
    .select("id, status, created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const link = joinLink(group, appUrl());
  const hostReady = (assignCount ?? 0) > 0 && (triviaCount ?? 0) > 0;
  // Answers are open only in "setup". The host can lock them (→ "ready") so no
  // one can submit or change anything before the game.
  const answersLocked = group.status !== "setup";

  // Per-member fill-out progress. What a member owes depends on type:
  //   consensus — all of them except their one holdout
  //   guess_who — everyone owes one each
  //   guess_what — only the picked target owes it
  const CONSENSUS_TYPES = ["pick_person", "likelihood", "multiple_choice", "open_text"];
  const { data: qRows } = await supabase
    .from("feud_questions")
    .select("id, type, target_member_id, is_buffer")
    .eq("group_id", id);
  // Buffered questions are hidden from the game, so they don't count toward what
  // members owe or how long the game can run.
  const allQs = (qRows ?? []).filter((q) => !q.is_buffer);
  const totalQuestions = allQs.length;
  const qIds = allQs.map((q) => q.id);
  const consensusCount = allQs.filter((q) => CONSENSUS_TYPES.includes(q.type)).length;
  const guessWhoCount = allQs.filter((q) => q.type === "guess_who").length;
  const guessWhatByTarget = new Map<string, number>();
  for (const q of allQs)
    if (q.type === "guess_what" && q.target_member_id)
      guessWhatByTarget.set(q.target_member_id, (guessWhatByTarget.get(q.target_member_id) ?? 0) + 1);

  const answeredByMember = new Map<string, number>();
  const holdoutCountByMember = new Map<string, number>();
  if (qIds.length) {
    const [{ data: resp }, { data: asg }] = await Promise.all([
      supabase.from("feud_responses").select("member_id").in("question_id", qIds),
      supabase.from("feud_question_assignments").select("member_id").eq("group_id", id),
    ]);
    for (const r of resp ?? []) answeredByMember.set(r.member_id, (answeredByMember.get(r.member_id) ?? 0) + 1);
    for (const a of asg ?? [])
      holdoutCountByMember.set(a.member_id, (holdoutCountByMember.get(a.member_id) ?? 0) + 1);
  }
  const memberProgress = players.map((m) => {
    const answered = answeredByMember.get(m.id) ?? 0;
    const target = Math.max(
      0,
      consensusCount -
        (holdoutCountByMember.get(m.id) ?? 0) +
        guessWhoCount +
        (guessWhatByTarget.get(m.id) ?? 0),
    );
    const status =
      totalQuestions === 0
        ? "waiting"
        : target === 0 || answered >= target
          ? "done"
          : answered > 0
            ? "progress"
            : "notstarted";
    return { id: m.id, name: m.display_name, answered, target, status };
  });
  const doneCount = memberProgress.filter((p) => p.status === "done").length;
  // Most questions-per-team the game can run (all consensus questions split evenly).
  const capacity = Math.max(1, Math.floor(consensusCount / Math.max(1, teams.length)));

  // Trivia bank view: each team's chosen topics + generated questions (with answers).
  const [{ data: triviaTopicRows }, { data: triviaQRows }] = await Promise.all([
    supabase
      .from("trivia_topics")
      .select("team_id, name, category")
      .eq("group_id", id)
      .eq("selected", true),
    supabase
      .from("trivia_questions")
      .select("team_id, topic, prompt, correct_answer, point_value")
      .eq("group_id", id)
      .order("created_at"),
  ]);
  const triviaView = teams.map((t) => ({
    team: t,
    topics: (triviaTopicRows ?? []).filter((x) => x.team_id === t.id),
    questions: (triviaQRows ?? []).filter((x) => x.team_id === t.id),
  }));

  const steps = [
    { n: 1, label: "Add feud questions", done: totalQuestions > 0, detail: `${totalQuestions} authored` },
    {
      n: 2,
      label: "Members answer their questions",
      done: players.length > 0 && doneCount >= players.length,
      detail: `${doneCount}/${players.length} finished`,
    },
    { n: 3, label: "Captains pick trivia topics", done: (topicCount ?? 0) > 0, detail: `${topicCount ?? 0} chosen` },
    { n: 4, label: "Generate the trivia bank", done: (triviaCount ?? 0) > 0, detail: `${triviaCount ?? 0} questions` },
    { n: 5, label: "Host the live game", done: false, detail: hostReady ? "ready to host!" : "" },
  ];
  const nextStepN = steps.find((s) => !s.done)?.n ?? 5;

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-cream/50 hover:text-cream">
        ← All groups
      </Link>

      {created && (
        <div className="mt-3 rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-sm text-green">
          🎉 <span className="font-semibold">{group.name}</span> is live in setup mode. Send the
          invites below, and watch answers roll in.
        </div>
      )}

      {/* header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black">{group.name}</h1>
          <p className="mt-1 text-sm text-cream/55">
            {CATEGORY_LABELS[group.category] ?? group.category}
            {group.dynamic_note ? ` · ${group.dynamic_note}` : ""}
          </p>
          <GroupAdmin groupId={group.id} name={group.name} />
          <GameSchedule
            groupId={group.id}
            gameDate={group.scheduled_time}
            answerDeadline={(group as Group & { answer_deadline: string | null }).answer_deadline ?? null}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="label">Join code</div>
            <div className="font-mono text-2xl font-bold tracking-[0.3em] text-cream">
              {group.join_code}
            </div>
          </div>
          <CopyButton text={link} label="Copy link" className="text-sm" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* left: readiness + roster */}
        <div className="space-y-6 lg:col-span-2">
          {/* answer lock */}
          <section
            className={
              "card p-5 " + (answersLocked ? "border-magenta/40 bg-magenta/5" : "border-green/30 bg-green/5")
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold">
                  {answersLocked ? "🔒 Answers are locked" : "🟢 Answers are open"}
                </h2>
                <p className="mt-1 text-sm text-cream/60">
                  {answersLocked
                    ? "Everyone can still review their answers, but no one can submit or change anything (answers, topics, team names, or logos)."
                    : "Members can still submit and edit their answers from their phones. Lock them when everyone's done so nothing changes before the game."}
                </p>
              </div>
              {group.status === "setup" && (
                <form action={setAnswerLock}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="lock" value="1" />
                  <button type="submit" className="btn btn-primary text-sm whitespace-nowrap">
                    🔒 Lock answers
                  </button>
                </form>
              )}
              {group.status === "ready" && (
                <form action={setAnswerLock}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="lock" value="0" />
                  <button type="submit" className="btn btn-ghost text-sm whitespace-nowrap">
                    🔓 Reopen answers
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* path to game night */}
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Path to game night</h2>
            <p className="mt-1 text-sm text-cream/55">
              Do these in order — the highlighted one is what&apos;s next.
            </p>
            <ol className="mt-3 space-y-1.5">
              {steps.map((s) => {
                const isNext = s.n === nextStepN;
                return (
                  <li
                    key={s.n}
                    className={
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm " +
                      (isNext ? "bg-magenta/10 ring-1 ring-magenta/40" : "")
                    }
                  >
                    <span
                      className={
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                        (s.done
                          ? "bg-green/20 text-green"
                          : isNext
                            ? "bg-magenta text-white"
                            : "bg-white/8 text-cream/40")
                      }
                    >
                      {s.done ? "✓" : s.n}
                    </span>
                    <span className={s.done || isNext ? "text-cream" : "text-cream/55"}>{s.label}</span>
                    <span className="ml-auto text-xs text-cream/45">{s.detail}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* fill-out progress */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Who&apos;s filled out</h2>
              <span className="text-sm text-cream/50">
                {doneCount}/{players.length} done
              </span>
            </div>
            {totalQuestions === 0 ? (
              <p className="mt-2 text-sm text-cream/55">
                Add feud questions first, then invite everyone — progress shows up here.
              </p>
            ) : (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {memberProgress.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="truncate">{p.name}</span>
                    <span
                      className={
                        "chip cursor-default text-xs " +
                        (p.status === "done"
                          ? "border-green/40 text-green"
                          : p.status === "progress"
                            ? "border-gold/40 text-gold"
                            : "border-white/15 text-cream/45")
                      }
                    >
                      {p.status === "done"
                        ? "✓ done"
                        : p.status === "progress"
                          ? `${p.answered}/${p.target}`
                          : "not started"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* setup tasks */}
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Build the game</h2>
            <p className="mt-1 text-sm text-cream/55">
              Author feud questions; captains pick trivia topics from their phones, then generate
              the bank.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/g/${group.id}/questions`}
                className="btn btn-secondary text-sm"
              >
                ✏️ Feud questions
              </Link>
              <Link
                href={`/dashboard/g/${group.id}/trivia`}
                className="btn btn-secondary text-sm"
              >
                🧠 Trivia &amp; topics
              </Link>
              <form action={generateTriviaBank}>
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="btn btn-ghost text-sm">
                  ⚡ Generate trivia bank
                </button>
              </form>
            </div>
            <p className="mt-2 text-xs text-cream/45">
              {topicCount ?? 0} topics chosen · {triviaCount ?? 0} trivia questions in the bank
            </p>
          </section>

          {/* trivia bank view */}
          {(triviaCount ?? 0) > 0 && (
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Trivia bank</h2>
                <Link href={`/dashboard/g/${group.id}/trivia`} className="btn btn-ghost text-xs">
                  ✏️ Edit questions &amp; topics
                </Link>
              </div>
              <p className="mt-1 text-sm text-cream/55">
                What each team will face. Edit any question, add your own, swap topics, or re-run
                &ldquo;Generate trivia bank&rdquo; for a fresh set.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {triviaView.map(({ team, topics, questions }) => (
                  <div key={team.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="font-display font-bold">{team.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {topics.map((t) => (
                        <span key={t.name} className="chip cursor-default text-xs">
                          {t.name}
                        </span>
                      ))}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm">
                      {questions.map((q, i) => (
                        <li
                          key={i}
                          className="border-t border-white/8 pt-2 first:border-0 first:pt-0"
                        >
                          <div className="text-xs text-cream/45">
                            {q.topic} · {q.point_value} pts
                          </div>
                          <div className="text-cream/90">{q.prompt}</div>
                          <div className="mt-0.5 text-xs text-green">✓ {q.correct_answer}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* roster by team */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Roster</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-cream/50">{players.length} players</span>
                {teams.length > 1 && players.length > 0 && (
                  <form action={reshuffleTeams}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button type="submit" className="btn btn-ghost text-xs">
                      🔀 Reshuffle teams
                    </button>
                  </form>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-cream/45">
              Move a player with the dropdown, tap ★ to make someone captain, ✏️ to rename a team, or
              reshuffle to redraw teams and captains at random.
            </p>
            <RosterEditor groupId={group.id} members={players} teams={teams} />

            {/* add member */}
            <form action={addMember} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="groupId" value={group.id} />
              <div className="flex-1">
                <label className="label" htmlFor="new-member">
                  Add a player
                </label>
                <input
                  id="new-member"
                  name="name"
                  className="input mt-1"
                  placeholder="New player's name"
                  maxLength={40}
                  required
                />
              </div>
              <select name="teamId" className="input w-auto" defaultValue="">
                <option value="">Balance automatically</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost">
                Add
              </button>
            </form>

            {/* answer-only names (not playing, but pickable) */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="font-display text-sm font-bold">Answer-only names</h3>
              <p className="mt-0.5 text-xs text-cream/45">
                Friends who won&apos;t be at game night but can still be picked as answers on
                pick-a-person questions. They don&apos;t join, get a team, or take a turn.
              </p>
              {guests.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {guests.map((g) => (
                    <li key={g.id}>
                      <form action={removeMember}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="memberId" value={g.id} />
                        <span className="chip cursor-default text-xs">
                          {g.display_name}
                          <button
                            type="submit"
                            className="ml-1 text-cream/40 hover:text-magenta"
                            title="Remove"
                            aria-label={`Remove ${g.display_name}`}
                          >
                            ✕
                          </button>
                        </span>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addGuest} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="groupId" value={group.id} />
                <div className="flex-1">
                  <input
                    name="name"
                    className="input"
                    placeholder="Add an answer-only name (a friend who can't make it)"
                    maxLength={40}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-ghost">
                  Add name
                </button>
              </form>
            </div>
          </section>

          {/* host */}
          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Host the live game</h2>
            {hostReady ? (
              <>
                <p className="mt-1 text-sm text-cream/55">
                  Mirror your screen to the TV and run it from here. Pick how long you want it — each
                  team plays the same number of questions, and trivia matches feud 1:1.
                </p>
                <GameLengthControl groupId={group.id} capacity={capacity} numTeams={teams.length} />
              </>
            ) : (
              <p className="mt-1 text-sm text-cream/55">
                Finish setup first — you need filled-out feud questions and a trivia bank. (Tip: the
                demo group comes fully loaded and is ready to host immediately.)
              </p>
            )}
          </section>

          {/* last game recap */}
          {latestGame && (
            <section className="card p-5">
              <h2 className="font-display text-lg font-bold">Last game recap</h2>
              <p className="mt-1 text-sm text-cream/55">
                Stats, superlatives and a player card for everyone — a fun, shareable wrap-up of your
                last game.
              </p>
              <a href={`/recap/${latestGame.id}`} className="btn btn-secondary mt-3 text-sm">
                🎬 Open recap
              </a>
            </section>
          )}
        </div>

        {/* right: invites */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">Invite your crew</h2>
          <p className="-mt-2 text-sm text-cream/55">
            One-tap copy. Send the captain message to your captains, the member message to
            everyone else.
          </p>
          <InviteCard
            title="For members"
            emoji="🎤"
            message={memberInvite(group, appUrl(), {
              questionCount: totalQuestions,
              deadline: (group as Group & { answer_deadline: string | null }).answer_deadline ?? null,
            })}
            accent="cyan"
          />
          <InviteCard
            title="For captains"
            emoji="🎖️"
            message={captainInvite(group, appUrl(), {
              questionCount: totalQuestions,
              deadline: (group as Group & { answer_deadline: string | null }).answer_deadline ?? null,
            })}
            accent="magenta"
          />
        </div>
      </div>
    </div>
  );
}
