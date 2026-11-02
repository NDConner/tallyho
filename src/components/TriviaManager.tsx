"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTriviaCategories,
  setTeamTopics,
  addTrivia,
  updateTrivia,
  deleteTrivia,
  addMoreTrivia,
} from "@/app/dashboard/g/[id]/actions";

interface ActiveCategory {
  name: string;
  custom: boolean;
  topics: string[];
}
interface TopicPick {
  name: string;
  category: string;
}
interface TriviaQ {
  id: string;
  topic: string;
  prompt: string;
  correct_answer: string;
  accepted_variants: string[];
}
interface TeamView {
  id: string;
  name: string;
  index: number;
  topics: TopicPick[];
  questions: TriviaQ[];
}

const DOT = ["bg-magenta", "bg-cyan", "bg-gold", "bg-green"];

export function TriviaManager({
  groupId,
  categories,
  catalog,
  teams,
}: {
  groupId: string;
  categories: ActiveCategory[];
  catalog: { category: string; topics: string[] }[];
  teams: TeamView[];
}) {
  return (
    <div className="space-y-6">
      <CategoryEditor groupId={groupId} categories={categories} catalog={catalog} />
      {teams.map((t) => (
        <TeamCard key={t.id} groupId={groupId} team={t} categories={categories} />
      ))}
    </div>
  );
}

// ─── Categories (host) ───────────────────────────────────────────────────────

function CategoryEditor({
  groupId,
  categories,
  catalog,
}: {
  groupId: string;
  categories: ActiveCategory[];
  catalog: { category: string; topics: string[] }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cats, setCats] = useState<ActiveCategory[]>(categories);
  const [custom, setCustom] = useState("");
  const builtin = catalog.map((c) => c.category);

  const has = (name: string) => cats.some((c) => c.name === name);
  function toggleBuiltin(name: string) {
    setCats((cs) =>
      has(name) ? cs.filter((c) => c.name !== name) : [...cs, { name, custom: false, topics: [] }],
    );
  }
  function addCustom() {
    const name = custom.trim().slice(0, 40);
    if (!name || has(name)) {
      setCustom("");
      return;
    }
    setCats((cs) => [...cs, { name, custom: true, topics: [] }]);
    setCustom("");
  }
  function removeCat(name: string) {
    setCats((cs) => cs.filter((c) => c.name !== name));
  }
  function save() {
    start(async () => {
      await setTriviaCategories({
        groupId,
        categories: cats.map((c) => ({ name: c.name, custom: c.custom })),
      });
      router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-bold">Categories</h2>
      <p className="mt-1 text-sm text-cream/55">
        The buckets captains pick topics within. Turn the built-ins on/off, or add your own (e.g. a
        company name for work trivia). Captains type their topics inside each.
      </p>

      <div className="mt-3">
        <div className="label mb-1">Built-in</div>
        <div className="flex flex-wrap gap-1.5">
          {builtin.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleBuiltin(name)}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                (has(name)
                  ? "border-magenta bg-magenta/20 text-cream"
                  : "border-white/15 bg-white/5 text-cream/60 hover:border-cyan")
              }
            >
              {has(name) ? "✓ " : "+ "}
              {name}
            </button>
          ))}
        </div>
      </div>

      {cats.some((c) => c.custom) && (
        <div className="mt-3">
          <div className="label mb-1">Custom</div>
          <div className="flex flex-wrap gap-1.5">
            {cats
              .filter((c) => c.custom)
              .map((c) => (
                <span key={c.name} className="chip cursor-default text-xs">
                  {c.name}
                  <button
                    onClick={() => removeCat(c.name)}
                    className="ml-1 text-cream/40 hover:text-magenta"
                    aria-label={`Remove ${c.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Add a custom category (e.g. “Acme Inc trivia”)"
          maxLength={40}
          className="input flex-1 text-sm"
        />
        <button onClick={addCustom} className="btn btn-ghost text-sm">
          + Category
        </button>
        <button onClick={save} disabled={pending} className="btn btn-primary text-sm">
          {pending ? "Saving…" : "Save categories"}
        </button>
      </div>
    </section>
  );
}

// ─── Per-team topics + questions ─────────────────────────────────────────────

function TeamCard({
  groupId,
  team,
  categories,
}: {
  groupId: string;
  team: TeamView;
  categories: ActiveCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addN, setAddN] = useState(5);

  function refresh() {
    router.refresh();
  }
  function saveQ(d: { topic: string; prompt: string; correctAnswer: string; variants: string[] }, id?: string) {
    start(async () => {
      if (id) await updateTrivia({ groupId, questionId: id, ...d });
      else await addTrivia({ groupId, teamId: team.id, ...d });
      setAdding(false);
      setEditingId(null);
      refresh();
    });
  }
  function removeQ(id: string) {
    start(async () => {
      await deleteTrivia({ groupId, questionId: id });
      refresh();
    });
  }
  function addMore() {
    start(async () => {
      await addMoreTrivia({ groupId, teamId: team.id, n: addN });
      refresh();
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <span className={"h-3 w-3 rounded-full " + DOT[team.index % DOT.length]} />
        <h2 className="font-display text-lg font-bold">{team.name}</h2>
        <span className="ml-auto text-xs text-cream/45">{team.questions.length} questions</span>
      </div>

      <TeamTopicsEditor groupId={groupId} team={team} categories={categories} />

      <div className="mt-4 space-y-2">
        {team.questions.map((q) =>
          editingId === q.id ? (
            <TriviaForm
              key={q.id}
              initial={q}
              pending={pending}
              onSave={(d) => saveQ(d, q.id)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={q.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="min-w-0">
                <div className="text-xs text-cream/45">{q.topic}</div>
                <div className="text-sm text-cream/90">{q.prompt}</div>
                <div className="mt-0.5 text-xs text-green">
                  ✓ {q.correct_answer}
                  {q.accepted_variants.length > 0 && (
                    <span className="text-cream/35"> · also: {q.accepted_variants.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => { setEditingId(q.id); setAdding(false); }} className="px-2 text-sm text-cream/50 hover:text-cyan" title="Edit">
                  ✏️
                </button>
                <button onClick={() => removeQ(q.id)} disabled={pending} className="px-2 text-sm text-cream/50 hover:text-magenta" title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding && (
        <div className="mt-2">
          <TriviaForm pending={pending} onSave={(d) => saveQ(d)} onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => { setAdding(true); setEditingId(null); }} className="btn btn-primary text-sm">
          + Add question
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={addMore} disabled={pending} className="btn btn-secondary text-sm">
            ➕ Add
          </button>
          <select
            value={addN}
            onChange={(e) => setAddN(Number(e.target.value))}
            className="input w-auto py-1 text-sm"
          >
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n} more
              </option>
            ))}
          </select>
          <span className="text-xs text-cream/40">from this team&apos;s topics</span>
        </div>
      </div>
    </section>
  );
}

function TeamTopicsEditor({
  groupId,
  team,
  categories,
}: {
  groupId: string;
  team: TeamView;
  categories: ActiveCategory[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [topics, setTopics] = useState<TopicPick[]>(team.topics);
  const [cat, setCat] = useState(categories[0]?.name ?? "");
  const [val, setVal] = useState("");
  const dirty = JSON.stringify(topics) !== JSON.stringify(team.topics);

  const catTopics = categories.find((c) => c.name === cat)?.topics ?? [];

  function add(name: string) {
    const n = name.trim().slice(0, 60);
    if (!n || !cat) return;
    if (topics.some((t) => t.name.toLowerCase() === n.toLowerCase() && t.category === cat)) return;
    setTopics((ts) => [...ts, { name: n, category: cat }]);
    setVal("");
  }
  function remove(t: TopicPick) {
    setTopics((ts) => ts.filter((x) => !(x.name === t.name && x.category === t.category)));
  }
  function save() {
    start(async () => {
      await setTeamTopics({ groupId, teamId: team.id, topics });
      router.refresh();
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-ink/40 p-3">
      <div className="label mb-1">Topics</div>
      {topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span key={`${t.category}:${t.name}`} className="chip cursor-default text-xs">
              <span className="text-cream/45">{t.category}:</span> {t.name}
              <button onClick={() => remove(t)} className="ml-1 text-cream/40 hover:text-magenta" aria-label={`Remove ${t.name}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-cream/45">No topics yet — add a few so trivia matches this team.</p>
      )}

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <select value={cat} onChange={(e) => { setCat(e.target.value); setVal(""); }} className="input w-auto py-1 text-sm">
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        {catTopics.length > 0 && (
          <select value="" onChange={(e) => e.target.value && add(e.target.value)} className="input w-auto py-1 text-sm">
            <option value="">Pick a topic…</option>
            {catTopics.map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
        )}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(val)}
          placeholder="or type a custom topic…"
          maxLength={60}
          className="input w-auto py-1 text-sm"
        />
        <button onClick={() => add(val)} className="btn btn-ghost text-xs">
          + Add
        </button>
        {dirty && (
          <button onClick={save} disabled={pending} className="btn btn-primary text-xs">
            {pending ? "Saving…" : "Save topics"}
          </button>
        )}
      </div>
    </div>
  );
}

function TriviaForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: TriviaQ;
  pending: boolean;
  onSave: (d: { topic: string; prompt: string; correctAnswer: string; variants: string[] }) => void;
  onCancel: () => void;
}) {
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [correct, setCorrect] = useState(initial?.correct_answer ?? "");
  const [variants, setVariants] = useState((initial?.accepted_variants ?? []).join(", "));
  const canSave = prompt.trim() && correct.trim();

  return (
    <div className="space-y-2 rounded-xl border border-magenta/30 bg-ink/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
        <input className="input text-sm" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (e.g. Space)" maxLength={40} />
        <input className="input text-sm" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Question prompt" maxLength={200} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input text-sm" value={correct} onChange={(e) => setCorrect(e.target.value)} placeholder="Correct answer" maxLength={120} />
        <input className="input text-sm" value={variants} onChange={(e) => setVariants(e.target.value)} placeholder="Also accept (comma-separated)" maxLength={200} />
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-ghost text-xs">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              topic,
              prompt,
              correctAnswer: correct,
              variants: variants.split(",").map((v) => v.trim()).filter(Boolean),
            })
          }
          disabled={!canSave || pending}
          className="btn btn-primary text-xs"
        >
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </button>
      </div>
    </div>
  );
}
