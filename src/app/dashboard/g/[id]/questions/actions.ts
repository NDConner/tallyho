"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recommendFeudQuestions, recommendedCount } from "@/lib/feud/recommend";
import { generateJSON, hasAI } from "@/lib/ai/anthropic";
import { logQuestions, topBankPrompts } from "@/lib/questionBank";
import type { FeudQuestionType } from "@/lib/types";

const TYPES: FeudQuestionType[] = [
  "pick_person",
  "likelihood",
  "multiple_choice",
  "open_text",
  "guess_who",
  "guess_what",
];

function cleanOptions(type: FeudQuestionType, options: string[] | null): string[] | null {
  if (type !== "multiple_choice" && type !== "likelihood") return null;
  const cleaned = (options ?? []).map((o) => o.trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

function revalidate(groupId: string) {
  revalidatePath(`/dashboard/g/${groupId}/questions`);
  revalidatePath(`/dashboard/g/${groupId}`);
}

/** guess_what needs exactly one target member; other types never carry one. */
function cleanTarget(type: FeudQuestionType, targetMemberId: string | null): string | null {
  return type === "guess_what" ? targetMemberId || null : null;
}

export async function addQuestion(input: {
  groupId: string;
  prompt: string;
  type: FeudQuestionType;
  options: string[] | null;
  targetMemberId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const prompt = input.prompt.trim();
  if (!prompt || !TYPES.includes(input.type)) return;
  const target = cleanTarget(input.type, input.targetMemberId ?? null);
  if (input.type === "guess_what" && !target) return; // must pick who answers

  const options = cleanOptions(input.type, input.options);
  await supabase.from("feud_questions").insert({
    group_id: input.groupId,
    prompt,
    type: input.type,
    options,
    target_member_id: target,
    source: "admin",
    ai_recommended: false,
    is_buffer: false,
  });
  const { data: grp } = await supabase.from("groups").select("category").eq("id", input.groupId).maybeSingle();
  await logQuestions([{ prompt, type: input.type, options }], {
    sourceGroupId: input.groupId,
    category: (grp?.category as string) ?? null,
  });
  revalidate(input.groupId);
}

export async function updateQuestion(input: {
  groupId: string;
  questionId: string;
  prompt: string;
  type: FeudQuestionType;
  options: string[] | null;
  targetMemberId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const prompt = input.prompt.trim();
  if (!prompt || !TYPES.includes(input.type)) return;
  const target = cleanTarget(input.type, input.targetMemberId ?? null);
  if (input.type === "guess_what" && !target) return;

  const options = cleanOptions(input.type, input.options);
  await supabase
    .from("feud_questions")
    .update({ prompt, type: input.type, options, target_member_id: target })
    .eq("id", input.questionId);
  const { data: grp } = await supabase.from("groups").select("category").eq("id", input.groupId).maybeSingle();
  await logQuestions([{ prompt, type: input.type, options }], {
    sourceGroupId: input.groupId,
    category: (grp?.category as string) ?? null,
  });
  revalidate(input.groupId);
}

export async function deleteQuestion(input: { groupId: string; questionId: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("feud_questions").delete().eq("id", input.questionId);
  revalidate(input.groupId);
}

/**
 * Core recommender. `replace` wipes the existing bank first (for "suggest a
 * whole new list"); otherwise it keeps what's there and nets `count` fresh ones
 * after de-duping ("add N more"). Optional `guidance` steers the AI. Seeds with
 * the highest-resonance prompts from past sessions (the global bank), then
 * AI-tailors with a key, deterministic without.
 */
async function recommendInto(
  groupId: string,
  opts: { replace: boolean; count: number; guidance?: string },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [{ data: group }, { data: members }, { data: existing }] = await Promise.all([
    supabase.from("groups").select("name, dynamic_note, category").eq("id", groupId).single(),
    supabase.from("members").select("display_name").eq("group_id", groupId).eq("is_playing", true),
    supabase.from("feud_questions").select("prompt").eq("group_id", groupId),
  ]);
  const memberNames = (members ?? []).map((m) => m.display_name);
  // When replacing, existing questions are about to be deleted, so they don't
  // constrain dedupe.
  const existingSet = opts.replace
    ? new Set<string>()
    : new Set((existing ?? []).map((e) => e.prompt.trim().toLowerCase()));
  const count = Math.max(1, opts.count);
  const guidance = (opts.guidance ?? "").trim().slice(0, 300);
  const category = (group?.category as string) ?? null;

  // Proven prompts from past sessions in this category (never targeted types).
  const bank = (await topBankPrompts(category, new Set(existingSet), 8)).filter(
    (b) => b.type !== "guess_what" && TYPES.includes(b.type as FeudQuestionType),
  );
  const bankRecs = bank.map((b) => ({
    prompt: b.prompt,
    type: b.type as FeudQuestionType,
    options: b.options ?? undefined,
  }));

  // Deterministic base, seeded with proven bank prompts.
  let recs = [
    ...bankRecs,
    ...recommendFeudQuestions({
      groupName: group?.name ?? "the group",
      memberNames,
      count: count + existingSet.size, // overshoot so we net new ones after dedupe
    }),
  ];

  let aiUsed = false;
  if (hasAI()) {
    const ai = await generateJSON<{
      questions: { prompt: string; type: string; options?: string[] }[];
    }>({
      system:
        "You write fun, varied 'Family Feud'-style party questions about a specific friend group. Bias toward pick-a-person and multiple-choice for clean tallies. Return JSON only.",
      prompt: `Group "${group?.name}". Good to know: ${group?.dynamic_note || "n/a"}. Members: ${memberNames.join(", ")}.
${guidance ? `The host wants the next questions to focus on: ${guidance}\n` : ""}${bank.length ? `Prompts that have landed well with similar groups (inspiration only, do NOT copy verbatim): ${bank.map((b) => b.prompt).slice(0, 8).join(" | ")}\n` : ""}Return exactly ${count} NEW questions as JSON: {"questions":[{"prompt":string,"type":"pick_person"|"likelihood"|"multiple_choice"|"open_text"|"guess_who","options"?:string[]}]}.
Do NOT repeat any of these existing questions: ${[...existingSet].slice(0, 40).join(" | ") || "(none yet)"}.
For pick_person, open_text and guess_who omit options. For multiple_choice give 4-6 options. For likelihood give a 4-point scale. guess_who prompts must make sense answered about yourself (e.g. "Your favorite movie?").`,
      maxTokens: 2200,
    });
    // guess_what needs a hand-picked target, so never auto-generate it.
    const valid = (ai?.questions ?? []).filter(
      (q) => q.prompt && q.type !== "guess_what" && TYPES.includes(q.type as FeudQuestionType),
    );
    if (valid.length >= Math.min(6, count)) {
      // Lead with the AI set; keep proven bank prompts as backfill.
      recs = [
        ...valid.map((q) => ({ prompt: q.prompt, type: q.type as FeudQuestionType, options: q.options })),
        ...bankRecs,
      ];
      aiUsed = true;
    }
  }

  // Dedupe against existing questions AND within the batch, then trim to count.
  const seen = new Set(existingSet);
  const final: typeof recs = [];
  for (const r of recs) {
    const key = r.prompt.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    final.push(r);
    if (final.length >= count) break;
  }

  if (opts.replace) {
    // Wipe the old bank (cascades responses + holdout assignments) before adding.
    await supabase.from("feud_questions").delete().eq("group_id", groupId);
  }
  if (final.length === 0) {
    revalidate(groupId);
    return;
  }

  const inserts = final.map((r) => ({
    group_id: groupId,
    prompt: r.prompt,
    type: r.type,
    options: cleanOptions(r.type, r.options ?? null),
    target_member_id: null as string | null,
    source: "recommended" as const,
    ai_recommended: aiUsed,
    is_buffer: false,
  }));
  await supabase.from("feud_questions").insert(inserts);
  await logQuestions(
    inserts.map((r) => ({ prompt: r.prompt, type: r.type, options: r.options })),
    { sourceGroupId: groupId, category },
  );
  revalidate(groupId);
}

/** Replace the whole bank with a fresh recommended overshoot set. */
export async function suggestNewList(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const guidance = String(formData.get("guidance") || "");
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("is_playing", true);
  await recommendInto(groupId, { replace: true, count: recommendedCount(count ?? 0), guidance });
}

/** Keep the current questions and append 10 fresh suggestions. */
export async function suggestMore(formData: FormData) {
  const groupId = String(formData.get("groupId") || "");
  if (!groupId) return;
  const guidance = String(formData.get("guidance") || "");
  await recommendInto(groupId, { replace: false, count: 10, guidance });
}
