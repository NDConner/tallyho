import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalize } from "@/lib/match";

// ============================================================================
// Global, cross-session question bank.
//
// Every authored question is logged here (service-role only), and when a game
// finishes we fold each consensus question's real consensus score back in as a
// "resonance" signal. The recommender reads the highest-resonance prompts for a
// group's category to bias future suggestions toward what actually plays well.
//
// All functions are BEST-EFFORT: they swallow errors so a missing table (before
// the 0003 migration is applied) or any hiccup never affects authoring or
// gameplay. The data is never surfaced to a different group's owner — it only
// feeds suggestions behind the service role.
// ============================================================================

export interface BankEntry {
  prompt: string;
  type: string;
  options?: string[] | null;
}

function normPrompt(p: string): string {
  return normalize(p).slice(0, 300);
}

/** Record that these questions were authored (dedup on normalized prompt+type). */
export async function logQuestions(
  entries: BankEntry[],
  opts: { sourceGroupId: string; category?: string | null },
): Promise<void> {
  if (!entries.length) return;
  try {
    const supabase = createSupabaseAdminClient();
    const rows = entries
      .filter((e) => e.prompt?.trim())
      .map((e) => ({
        prompt: e.prompt.trim().slice(0, 300),
        normalized_prompt: normPrompt(e.prompt),
        type: e.type,
        category: opts.category ?? null,
        options: e.options ?? null,
        source_group_id: opts.sourceGroupId,
        last_used_at: new Date().toISOString(),
      }));
    await supabase
      .from("question_bank")
      .upsert(rows, { onConflict: "normalized_prompt,type", ignoreDuplicates: true });
  } catch {
    /* table may not exist yet — ignore */
  }
}

/** Fold a played question's consensus score into its running resonance average. */
export async function recordResonance(
  samples: { prompt: string; type: string; category?: string | null; options?: string[] | null; consensus: number }[],
  sourceGroupId: string,
): Promise<void> {
  if (!samples.length) return;
  try {
    const supabase = createSupabaseAdminClient();
    for (const s of samples) {
      const norm = normPrompt(s.prompt);
      const { data: existing } = await supabase
        .from("question_bank")
        .select("id, resonance, resonance_samples, play_count")
        .eq("normalized_prompt", norm)
        .eq("type", s.type)
        .maybeSingle();
      if (existing) {
        const n = existing.resonance_samples ?? 0;
        const prev = Number(existing.resonance ?? 0);
        const nextAvg = (prev * n + s.consensus) / (n + 1);
        await supabase
          .from("question_bank")
          .update({
            resonance: nextAvg,
            resonance_samples: n + 1,
            play_count: (existing.play_count ?? 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("question_bank").insert({
          prompt: s.prompt.trim().slice(0, 300),
          normalized_prompt: norm,
          type: s.type,
          category: s.category ?? null,
          options: s.options ?? null,
          source_group_id: sourceGroupId,
          resonance: s.consensus,
          resonance_samples: 1,
          play_count: 1,
        });
      }
    }
  } catch {
    /* ignore */
  }
}

/** Highest-resonance prompts for a category, excluding ones already in use. */
export async function topBankPrompts(
  category: string | null | undefined,
  exclude: Set<string>,
  limit: number,
): Promise<BankEntry[]> {
  if (limit <= 0) return [];
  try {
    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("question_bank")
      .select("prompt, type, options, resonance, times_used")
      .order("resonance", { ascending: false, nullsFirst: false })
      .order("times_used", { ascending: false })
      .limit(80);
    if (category) q = q.eq("category", category);
    const { data } = await q;
    const out: BankEntry[] = [];
    for (const r of data ?? []) {
      if (exclude.has(normPrompt(r.prompt))) continue;
      out.push({ prompt: r.prompt, type: r.type, options: (r.options as string[] | null) ?? null });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
