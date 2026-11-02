"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSchedule } from "@/app/dashboard/g/[id]/actions";

/** ISO → value for <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pretty(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function GameSchedule({
  groupId,
  gameDate,
  answerDeadline,
}: {
  groupId: string;
  gameDate: string | null;
  answerDeadline: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(toLocalInput(gameDate));
  const [deadline, setDeadline] = useState(toLocalInput(answerDeadline));

  function save() {
    start(async () => {
      await setSchedule({ groupId, gameDate: date, answerDeadline: deadline });
      setEditing(false);
      router.refresh();
    });
  }

  const gd = pretty(gameDate);
  const dl = pretty(answerDeadline);

  if (!editing) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cream/60">
        <span>🗓️ Game: <span className="text-cream">{gd ?? "not set"}</span></span>
        <span>⏰ Answers due: <span className="text-cream">{dl ?? "not set"}</span></span>
        <button onClick={() => setEditing(true)} className="text-xs text-cyan hover:underline">
          ✏️ {gd || dl ? "Edit" : "Set dates"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="label">Game date &amp; time</span>
        <input
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input mt-1 w-auto"
        />
      </label>
      <label className="block">
        <span className="label">Answers due by</span>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="input mt-1 w-auto"
        />
      </label>
      <div className="flex gap-2">
        <button onClick={save} disabled={pending} className="btn btn-primary text-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="btn btn-ghost text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
