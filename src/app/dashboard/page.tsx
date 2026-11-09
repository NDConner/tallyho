import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS } from "@/lib/brand";
import { seedDemoGroup } from "./actions";
import type { Group } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  setup: "border-cyan/30 bg-cyan/10 text-cyan",
  ready: "border-green/30 bg-green/10 text-green",
  live: "border-magenta/30 bg-magenta/10 text-magenta-soft",
  done: "border-white/20 bg-white/5 text-cream/50",
};
const STATUS_LABEL: Record<string, string> = {
  setup: "open",
  ready: "locked",
  live: "live",
  done: "closed",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  const groups = (data ?? []) as Group[];

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black">Your groups</h1>
          <p className="mt-1 text-sm text-cream/60">
            Build a group, gather answers, then host the live game.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/me" className="btn btn-ghost whitespace-nowrap">
            🏠 Your home
          </Link>
          <form action={seedDemoGroup}>
            <button type="submit" className="btn btn-ghost whitespace-nowrap">
              🎲 Demo group
            </button>
          </form>
          <Link href="/dashboard/new" className="btn btn-primary whitespace-nowrap">
            + New group
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <div className="text-5xl">🎤</div>
          <h2 className="mt-4 font-display text-2xl font-bold">No groups yet</h2>
          <p className="mt-2 max-w-sm text-sm text-cream/60">
            Spin up your first group — add everyone&apos;s names, pick a vibe, and we&apos;ll
            generate a private portal your crew fills out.
          </p>
          <Link href="/dashboard/new" className="btn btn-primary mt-6">
            Create your first group →
          </Link>
          <form action={seedDemoGroup} className="mt-3">
            <button type="submit" className="btn btn-ghost">
              or spin up a demo group 🎲
            </button>
          </form>
          <p className="mt-2 text-xs text-cream/40">
            The demo fakes a full filled-out group so you can play the live game right now —
            no API key needed.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/g/${g.id}`}
              className="card group p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-xl font-bold">{g.name}</h3>
                <span
                  className={`chip cursor-default border ${STATUS_STYLE[g.status] ?? STATUS_STYLE.setup}`}
                >
                  {STATUS_LABEL[g.status] ?? g.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-cream/55">
                {CATEGORY_LABELS[g.category] ?? g.category}
              </p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-cream/50">
                  Code{" "}
                  <span className="font-mono font-semibold tracking-widest text-cream">
                    {g.join_code}
                  </span>
                </span>
                <span className="text-cyan group-hover:underline">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
