"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminResetPassword, adminDeleteUser } from "@/app/admin/actions";

/** Per-user admin controls: reset the password (returns a temp one to relay) or
 *  delete the account. */
export function AdminUserRow({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setErr(null);
    setTemp(null);
    start(async () => {
      const r = await adminResetPassword({ userId });
      if (r.ok) setTemp(r.password ?? null);
      else setErr(r.error ?? "Couldn't reset.");
    });
  }
  function del() {
    if (!confirm(`Delete ${email}? This permanently removes their account. Their game slots free up to re-claim.`))
      return;
    setErr(null);
    start(async () => {
      const r = await adminDeleteUser({ userId });
      if (!r.ok) setErr(r.error ?? "Couldn't delete.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button onClick={reset} disabled={pending} className="btn btn-ghost px-2 py-1 text-xs">
        🔑 Reset password
      </button>
      <button
        onClick={del}
        disabled={pending}
        className="text-xs text-cream/40 underline hover:text-magenta"
      >
        Delete
      </button>
      {temp && (
        <span className="text-xs text-green">
          Temp password: <span className="font-mono font-semibold">{temp}</span> — relay it to them
        </span>
      )}
      {err && <span className="text-xs text-magenta">{err}</span>}
    </div>
  );
}
