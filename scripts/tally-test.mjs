#!/usr/bin/env node
// ============================================================================
// Tallyho test harness — dress-rehearse a group before the real event.
//
//   node scripts/tally-test.mjs list
//   node scripts/tally-test.mjs clone "Conner Clan" "Conner Clan TEST"
//   node scripts/tally-test.mjs fill  "Conner Clan TEST"        # bulk-answer everyone + pick captain topics
//   node scripts/tally-test.mjs status "Conner Clan TEST"
//   node scripts/tally-test.mjs reset "Conner Clan TEST"        # wipe answers/trivia/games, keep setup
//   node scripts/tally-test.mjs teardown "Conner Clan TEST"     # delete the test group entirely
//   node scripts/tally-test.mjs make "Test Crew" --members 8 --teams 2
//
// Uses the Supabase service-role key from .env.local (bypasses RLS). No deps.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of fs.readFileSync(path.resolve(DIR, "../.env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SVC) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}
const H = { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" };

async function rest(p, opts = {}) {
  const res = await fetch(`${URL_}/rest/v1/${p}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${p} :: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const get = (p) => rest(p);
const insert = (table, rows) =>
  rest(table, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(rows) });
const patch = (p, body) => rest(p, { method: "PATCH", body: JSON.stringify(body) });
const del = (p) => rest(p, { method: "DELETE" });

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const code = () => Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");

async function findGroup(name) {
  const g = await get(`groups?name=eq.${encodeURIComponent(name)}&select=*&order=created_at.desc&limit=1`);
  if (!g.length) throw new Error(`No group named "${name}"`);
  return g[0];
}

// ---------------------------------------------------------------- embedded data
const CATALOG = [
  { category: "Sports", topics: ["Baseball", "Basketball", "NFL Football", "Soccer", "Golf", "Olympics"] },
  { category: "Geography", topics: ["World Capitals", "US States", "Mountains", "Oceans & Seas", "Landmarks", "Rivers & Lakes"] },
  { category: "Literature", topics: ["Shakespeare", "Harry Potter", "Classic Novels", "Greek Mythology", "Sci-Fi", "Fantasy"] },
  { category: "Entertainment", topics: ["Disney", "90s Movies", "Marvel", "Star Wars", "Classic Rock", "Video Games"] },
  { category: "Science & Nature", topics: ["Space", "Animals", "The Human Body", "Chemistry", "Dinosaurs", "The Ocean"] },
];
const NAMES = ["Alex", "Sam", "Jordan", "Casey", "Riley", "Taylor", "Morgan", "Jamie", "Drew", "Quinn", "Avery", "Reese"];
const PICK = [
  "Who is most likely to get famous?", "Who shows up late to everything?", "Who gives the best advice?",
  "Who would survive a zombie apocalypse?", "Who is the most competitive?", "Who is the secret softie?",
  "Who texts back the slowest?", "Who is most likely to start a business?", "Who would win a dance-off?",
  "Who is the worst at keeping a secret?", "Who is most likely to cry at a movie?", "Who would go viral?",
];
const OPEN_BUCKETS = ["Chaos", "Classic", "Honestly yes", "No chance", "Every time", "Legendary"];
const CONSENSUS = ["pick_person", "likelihood", "multiple_choice", "open_text"];
// Varied personal answers so "whose answer?" has distinct things to guess.
const WHO_ANSWERS = ["Taylor Swift", "Kendrick Lamar", "Fleetwood Mac", "Beyoncé", "The Beatles", "Zach Bryan", "Daft Punk", "Dolly Parton", "Bad Bunny", "Radiohead", "SZA", "Prince"];
const FMK_ANSWERS = ["Marry the chef, kiss the pilot, skip the DJ", "Marry Gosling, kiss Pascal, pass on the rest", "Honestly? Marry all three"];

// ---------------------------------------------------------------- commands
async function cmdList() {
  const gs = await get("groups?select=name,join_code,status,created_at&order=created_at.desc");
  for (const g of gs) console.log(`  ${g.join_code}  ${g.name.padEnd(22)} ${g.status}`);
}

async function cmdMake(name, { members = 8, teams = 2 } = {}) {
  const src = (await get("groups?select=created_by&limit=1"))[0];
  if (!src) throw new Error("No existing group to borrow created_by (sign up once first).");
  const [group] = await insert("groups", {
    created_by: src.created_by, name, category: "friends", dynamic_note: "Test crew",
    num_teams: teams, num_rounds: 1, team_assignment: "random", join_code: code(), status: "setup",
  });
  const teamRows = await insert("teams", Array.from({ length: teams }, (_, i) => ({ group_id: group.id, name: `Team ${i + 1}`, team_index: i })));
  const names = shuffle(NAMES).slice(0, members);
  const memberRows = await insert("members", names.map((n, i) => ({
    group_id: group.id, display_name: n, team_id: teamRows[i % teams].id, is_captain: false,
  })));
  // one captain per team
  for (const t of teamRows) {
    const cap = memberRows.find((m) => m.team_id === t.id);
    if (cap) { await patch(`members?id=eq.${cap.id}`, { is_captain: true }); await patch(`teams?id=eq.${t.id}`, { captain_member_id: cap.id }); }
  }
  // feud questions (overshoot) + one of each new targeted type
  const want = Math.ceil(members * 1.5) + 3;
  const qs = [];
  for (const p of shuffle(PICK)) qs.push({ group_id: group.id, prompt: p, type: "pick_person", source: "recommended" });
  qs.push({ group_id: group.id, prompt: "How does the group plan a trip?", type: "multiple_choice", options: ["Spreadsheet", "Group chat chaos", "One person decides", "It never happens"], source: "recommended" });
  qs.push({ group_id: group.id, prompt: "First word you think of for this crew?", type: "open_text", source: "recommended" });
  const chosen = qs.slice(0, want);
  chosen.push({ group_id: group.id, prompt: "Your all-time favorite music artist?", type: "guess_who", source: "recommended" });
  chosen.push({ group_id: group.id, prompt: "FMK: three celebrities of your choice", type: "guess_what", target_member_id: memberRows[0].id, source: "recommended" });
  // PostgREST bulk insert needs every row to carry the same keys.
  await insert(
    "feud_questions",
    chosen.map((q) => ({
      group_id: group.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options ?? null,
      target_member_id: q.target_member_id ?? null,
      source: q.source,
    })),
  );
  console.log(`Made "${name}" (${group.join_code}) — ${members} players, ${teams} teams, ${Math.min(qs.length, want)} questions.`);
  console.log(`Next:  node scripts/tally-test.mjs fill "${name}"`);
}

async function cmdClone(srcName, newName) {
  const src = await findGroup(srcName);
  newName = newName || `${srcName} TEST`;
  const [group] = await insert("groups", {
    created_by: src.created_by, name: newName, category: src.category, category_custom_desc: src.category_custom_desc,
    dynamic_note: src.dynamic_note, num_teams: src.num_teams, num_rounds: src.num_rounds,
    team_assignment: src.team_assignment, join_code: code(), status: "setup",
  });
  const srcTeams = await get(`teams?group_id=eq.${src.id}&select=*&order=team_index`);
  const srcMembers = await get(`members?group_id=eq.${src.id}&select=*&order=created_at`);
  const srcQs = await get(`feud_questions?group_id=eq.${src.id}&select=prompt,type,options,source,is_buffer,target_member_id&order=created_at`);
  const newTeams = await insert("teams", srcTeams.map((t) => ({ group_id: group.id, name: t.name, team_index: t.team_index })));
  const teamMap = new Map(srcTeams.map((t, i) => [t.id, newTeams[i].id]));
  const newMembers = await insert("members", srcMembers.map((m) => ({
    group_id: group.id, display_name: m.display_name, is_captain: m.is_captain,
    team_id: m.team_id ? teamMap.get(m.team_id) : null,
  })));
  // remap captains on teams
  const nameToNew = new Map(newMembers.map((m) => [m.team_id + "|" + m.display_name, m.id]));
  const oldMemberToNew = new Map(
    srcMembers.map((m) => [m.id, m.team_id ? nameToNew.get(teamMap.get(m.team_id) + "|" + m.display_name) : null]),
  );
  for (const t of srcTeams) {
    if (!t.captain_member_id) continue;
    const srcCap = srcMembers.find((m) => m.id === t.captain_member_id);
    if (!srcCap) continue;
    const newCapId = nameToNew.get(teamMap.get(t.id) + "|" + srcCap.display_name);
    if (newCapId) await patch(`teams?id=eq.${teamMap.get(t.id)}`, { captain_member_id: newCapId });
  }
  if (srcQs.length)
    await insert(
      "feud_questions",
      srcQs.map((q) => ({
        group_id: group.id,
        prompt: q.prompt,
        type: q.type,
        options: q.options,
        source: q.source,
        is_buffer: q.is_buffer,
        target_member_id: q.target_member_id ? oldMemberToNew.get(q.target_member_id) ?? null : null,
      })),
    );
  console.log(`Cloned "${srcName}" -> "${newName}" (${group.join_code}): ${srcMembers.length} players, ${srcTeams.length} teams, ${srcQs.length} questions.`);
  console.log(`Next:  node scripts/tally-test.mjs fill "${newName}"`);
}

function answersFor(question, n) {
  let pool;
  if (question.type === "pick_person") pool = question._names;
  else if (question.type === "open_text") pool = shuffle(OPEN_BUCKETS).slice(0, 3);
  else pool = (question.options && question.options.length ? question.options : ["Yes", "No", "Maybe"]);
  pool = shuffle(pool);
  const winner = pool[0], runner = pool[1] ?? pool[0];
  const out = [];
  for (let i = 0; i < Math.ceil(n * 0.55); i++) out.push(winner);
  for (let i = 0; i < Math.ceil(n * 0.25); i++) out.push(runner);
  while (out.length < n) out.push(rnd(pool));
  return shuffle(out).slice(0, n);
}

async function cmdFill(name) {
  const group = await findGroup(name);
  const members = await get(`members?group_id=eq.${group.id}&select=id,display_name,team_id,is_captain&order=created_at`);
  const teams = await get(`teams?group_id=eq.${group.id}&select=id&order=team_index`);
  const questions = await get(`feud_questions?group_id=eq.${group.id}&select=id,type,options,target_member_id&order=created_at`);
  const consensus = questions.filter((q) => CONSENSUS.includes(q.type));
  if (consensus.length < members.length)
    console.log(`  (heads up: ${consensus.length} consensus questions for ${members.length} players — some won't get a holdout)`);
  const names = members.map((m) => m.display_name);

  // wipe prior test state
  const qids = questions.map((q) => q.id);
  if (qids.length) await del(`feud_responses?question_id=in.(${qids.join(",")})`);
  await del(`feud_question_assignments?group_id=eq.${group.id}`);

  // distinct holdout per member (consensus questions only)
  const cshuf = shuffle(consensus);
  const holdout = new Map();
  members.forEach((m, i) => { if (i < cshuf.length) holdout.set(m.id, cshuf[i].id); });
  const asg = members.filter((m) => holdout.has(m.id)).map((m) => ({ group_id: group.id, question_id: holdout.get(m.id), member_id: m.id }));
  if (asg.length) await insert("feud_question_assignments", asg);

  const responses = [];
  // consensus: everyone answers all-but-their-holdout, with clear plurality
  for (const q of consensus) {
    q._names = names;
    const answerers = members.filter((m) => holdout.get(m.id) !== q.id);
    const ans = answersFor(q, answerers.length);
    answerers.forEach((m, i) => responses.push({ question_id: q.id, member_id: m.id, raw_answer: ans[i], normalized_bucket: ans[i] }));
  }
  // guess_who: everyone answers a distinct-ish personal answer
  const whoPool = shuffle(WHO_ANSWERS);
  for (const q of questions.filter((q) => q.type === "guess_who")) {
    members.forEach((m, i) => { const a = whoPool[i % whoPool.length]; responses.push({ question_id: q.id, member_id: m.id, raw_answer: a, normalized_bucket: a }); });
  }
  // guess_what: only the hand-picked target answers
  for (const q of questions.filter((q) => q.type === "guess_what" && q.target_member_id)) {
    const a = rnd(FMK_ANSWERS);
    responses.push({ question_id: q.id, member_id: q.target_member_id, raw_answer: a, normalized_bucket: a });
  }
  for (let i = 0; i < responses.length; i += 500) await insert("feud_responses", responses.slice(i, i + 500));

  // captains pick one topic per category, per team
  await del(`trivia_topics?group_id=eq.${group.id}`);
  const topicRows = [];
  for (const t of teams) {
    for (const c of CATALOG) topicRows.push({ group_id: group.id, team_id: t.id, category: c.category, name: rnd(c.topics), selected: true, source: "custom" });
  }
  await insert("trivia_topics", topicRows);

  await patch(`groups?id=eq.${group.id}`, { status: "setup" });
  console.log(`Filled "${name}" (${group.join_code}): ${responses.length} answers across ${members.length} players, holdout each, ${topicRows.length} topics picked.`);
  console.log(`In the app: open this group -> click "⚡ Generate trivia bank" -> "▶ Host live game".`);
}

async function cmdStatus(name) {
  const group = await findGroup(name);
  const members = await get(`members?group_id=eq.${group.id}&select=id,display_name,is_captain&order=created_at`);
  const questions = await get(`feud_questions?group_id=eq.${group.id}&select=id`);
  const asg = await get(`feud_question_assignments?group_id=eq.${group.id}&select=member_id,question_id`);
  const qids = questions.map((q) => q.id);
  const resp = qids.length ? await get(`feud_responses?question_id=in.(${qids.join(",")})&select=member_id`) : [];
  const trivia = await get(`trivia_questions?group_id=eq.${group.id}&select=id`);
  const topics = await get(`trivia_topics?group_id=eq.${group.id}&selected=eq.true&select=team_id`);
  const holdout = new Map(asg.map((a) => [a.member_id, a.question_id]));
  const answered = new Map();
  for (const r of resp) answered.set(r.member_id, (answered.get(r.member_id) || 0) + 1);
  console.log(`\n${group.name}  (${group.join_code})  status=${group.status}`);
  console.log(`questions: ${questions.length} | topics chosen: ${topics.length} | trivia bank: ${trivia.length}`);
  for (const m of members) {
    const a = answered.get(m.id) || 0, target = questions.length - (holdout.has(m.id) ? 1 : 0);
    console.log(`  ${(m.display_name + (m.is_captain ? " (cap)" : "")).padEnd(18)} ${a}/${target} answered  holdout:${holdout.has(m.id) ? "yes" : "NONE"}`);
  }
  const hostReady = asg.length >= members.length && trivia.length > 0;
  console.log(hostReady ? ">> READY TO HOST" : ">> not host-ready yet (need holdouts for all + generated trivia bank)");
}

async function cmdReset(name) {
  const group = await findGroup(name);
  const questions = await get(`feud_questions?group_id=eq.${group.id}&select=id`);
  const qids = questions.map((q) => q.id);
  if (qids.length) await del(`feud_responses?question_id=in.(${qids.join(",")})`);
  await del(`feud_question_assignments?group_id=eq.${group.id}`);
  await del(`trivia_questions?group_id=eq.${group.id}`);
  await del(`trivia_topics?group_id=eq.${group.id}`);
  const games = await get(`games?group_id=eq.${group.id}&select=id`);
  for (const g of games) { await del(`game_scores?game_id=eq.${g.id}`); await del(`game_events?game_id=eq.${g.id}`); }
  await del(`games?group_id=eq.${group.id}`);
  await patch(`groups?id=eq.${group.id}`, { status: "setup" });
  console.log(`Reset "${name}" to blank setup (kept members, teams, questions).`);
}

async function cmdTeardown(name) {
  const group = await findGroup(name);
  await del(`groups?id=eq.${group.id}`); // cascades to all children
  console.log(`Deleted "${name}" (${group.join_code}) and everything under it.`);
}

// ---------------------------------------------------------------- dispatch
const [cmd, ...rest_] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest_.length; i++) {
  if (rest_[i].startsWith("--")) flags[rest_[i].slice(2)] = rest_[i + 1], i++;
  else positional.push(rest_[i]);
}
try {
  if (cmd === "list") await cmdList();
  else if (cmd === "make") await cmdMake(positional[0], { members: +(flags.members || 8), teams: +(flags.teams || 2) });
  else if (cmd === "clone") await cmdClone(positional[0], positional[1]);
  else if (cmd === "fill") await cmdFill(positional[0]);
  else if (cmd === "status") await cmdStatus(positional[0]);
  else if (cmd === "reset") await cmdReset(positional[0]);
  else if (cmd === "teardown") await cmdTeardown(positional[0]);
  else console.log('Commands: list | make <name> [--members N --teams N] | clone <src> [newName] | fill <name> | status <name> | reset <name> | teardown <name>');
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
