"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameGroup, deleteGroup } from "@/app/dashboard/g/[id]/actions";

/** Inline rename + delete controls for a group (shown under its title). */
export function GroupAdmin({ groupId, name }: { groupId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  function saveName() {
    const next = val.trim();
    if (!next || next === name) {
      setEditing(false);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("name", next);
      await renameGroup(fd);
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={val}
          maxLength={60}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName();
            if (e.key === "Escape") {
              setVal(name);
              setEditing(false);
            }
          }}
          className="input w-auto text-sm"
        />
        <button onClick={saveName} disabled={pending} className="btn btn-primary text-xs">
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setVal(name);
            setEditing(false);
          }}
          className="btn btn-ghost text-xs"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button onClick={() => { setVal(name); setEditing(true); }} className="text-xs text-cream/45 hover:text-cyan">
        ✏️ Rename
      </button>
      <form
        action={deleteGroup}
        onSubmit={(e) => {
          if (
            !confirm(
              `Delete “${name}”? This permanently removes the group, its questions, answers, and games. This cannot be undone.`,
            )
          )
            e.preventDefault();
        }}
      >
        <input type="hidden" name="groupId" value={groupId} />
        <button type="submit" className="text-xs text-cream/45 hover:text-magenta">
          🗑️ Delete group
        </button>
      </form>
    </div>
  );
}
