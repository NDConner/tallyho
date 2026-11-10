import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdmin, adminEmails } from "@/lib/admin";
import { AdminUserRow } from "@/components/AdminUserRow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Tallyho" };

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="truncate text-sm text-cream/85">{value && value.trim() ? value : "—"}</div>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" aria-label="Tallyho home">
          <Wordmark size="sm" />
        </Link>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-cream/50 underline hover:text-cream">Sign out</button>
        </form>
      </div>
      {children}
    </main>
  );

  if (!isAdmin(user.email)) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-black">Admin console</h1>
        <div className="card mt-4 p-6 text-sm text-cream/70">
          <p>You don&apos;t have admin access.</p>
          {adminEmails().length === 0 && (
            <p className="mt-2 text-cream/50">
              No admins are configured yet. Set the{" "}
              <span className="font-mono text-cream">ADMIN_EMAILS</span> environment variable (comma-
              separated emails) on your host and in <span className="font-mono text-cream">.env.local</span>,
              then sign in with one of those emails.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = list?.users ?? [];
  const ids = users.map((u) => u.id);

  const [{ data: profiles }, { data: members }] = await Promise.all([
    ids.length
      ? admin.from("profiles").select("*").in("user_id", ids)
      : Promise.resolve({ data: [] as Record<string, string | null>[] }),
    admin.from("members").select("user_id").not("user_id", "is", null),
  ]);
  const profById = new Map((profiles ?? []).map((p) => [p.user_id as string, p]));
  const gamesByUser = new Map<string, number>();
  for (const m of members ?? [])
    gamesByUser.set(m.user_id as string, (gamesByUser.get(m.user_id as string) ?? 0) + 1);

  const withProfile = users.filter((u) => profById.has(u.id)).length;

  return (
    <Shell>
      <h1 className="font-display text-2xl font-black">Admin console</h1>
      <p className="mt-1 text-sm text-cream/60">
        Every account, its demographics, and the games it&apos;s in — plus password resets and account
        removal. You&apos;re signed in as {user.email}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4 text-center">
          <div className="font-display text-3xl font-black tabular-nums">{users.length}</div>
          <div className="label mt-1">Users</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-3xl font-black tabular-nums">{withProfile}</div>
          <div className="label mt-1">With profile</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-display text-3xl font-black tabular-nums">
            {[...gamesByUser.values()].reduce((s, n) => s + n, 0)}
          </div>
          <div className="label mt-1">Game memberships</div>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {users.map((u) => {
          const p = profById.get(u.id) as Record<string, string | null> | undefined;
          return (
            <section key={u.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold">
                    {(p?.username && p.username.trim()) || u.email || "User"}
                  </h2>
                  <p className="text-sm text-cream/55">{u.email}</p>
                </div>
                <div className="text-right text-xs text-cream/45">
                  <div>Joined {fmt(u.created_at)}</div>
                  <div>Last in {fmt(u.last_sign_in_at)}</div>
                  <div>{gamesByUser.get(u.id) ?? 0} games</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Full name" value={p?.full_name} />
                <Field label="Age range" value={p?.age_range} />
                <Field label="Gender" value={p?.gender} />
                <Field label="Location" value={p?.location} />
                <Field label="Occupation" value={p?.occupation} />
                <div className="min-w-0 sm:col-span-3">
                  <div className="label">Interests</div>
                  <div className="text-sm text-cream/85">{p?.interests?.trim() ? p.interests : "—"}</div>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-3">
                <AdminUserRow userId={u.id} email={u.email ?? ""} />
              </div>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
