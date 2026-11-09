"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addKnownPlayer } from "@/app/dashboard/g/[id]/actions";

/** Re-add people who've played in your games before, by their account — the slot
 *  links to them (shows on their home) and they get a notification. */
export function KnownPlayerAdder({
  groupId,
  players,
}: {
  groupId: string;
  players: { userId: string; name: string; email: string | null }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (players.length === 0) {
    return (
      <p className="text-xs text-cream/45">
        No returning players yet — anyone who signs in and claims a name in your games shows up here to
        re-add in one tap.
      </p>
    );
  }

  function add(userId: string, name: string) {
    setErr(null);
    setBusyId(userId);
    start(async () => {
      const res = await addKnownPlayer({ groupId, userId, name });
      setBusyId(null);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "Couldn't add.");
    });
  }

  return (
    <div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {players.map((pl) => (
          <li
            key={pl.userId}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-semibold text-cream">{pl.name}</span>
              {pl.email && <span className="block truncate text-xs text-cream/45">{pl.email}</span>}
            </span>
            <button
              onClick={() => add(pl.userId, pl.name)}
              disabled={pending}
              className="btn btn-ghost shrink-0 text-xs"
            >
              {busyId === pl.userId ? "Adding…" : "+ Add & notify"}
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-sm text-magenta">{err}</p>}
    </div>
  );
}
