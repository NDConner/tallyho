"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moveMember,
  setCaptain,
  renameTeam,
  renameMember,
  unclaimMember,
} from "@/app/dashboard/g/[id]/actions";
import type { Member, Team } from "@/lib/types";

export function RosterEditor({
  groupId,
  members,
  teams,
  linkedEmail = {},
}: {
  groupId: string;
  members: Member[];
  teams: Team[];
  /** memberId → the email of the account that claimed it (or "linked" if unknown). */
  linkedEmail?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editTeam, setEditTeam] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [editMember, setEditMember] = useState<string | null>(null);
  const [memberName, setMemberName] = useState("");

  function move(memberId: string, teamId: string) {
    start(async () => {
      await moveMember({ groupId, memberId, teamId });
      router.refresh();
    });
  }
  function makeCaptain(memberId: string) {
    start(async () => {
      await setCaptain({ groupId, memberId });
      router.refresh();
    });
  }
  function saveTeamName(teamId: string, original: string) {
    const name = teamName.trim();
    setEditTeam(null);
    if (!name || name === original) return;
    start(async () => {
      await renameTeam({ groupId, teamId, name });
      router.refresh();
    });
  }
  function saveMemberName(memberId: string, original: string) {
    const name = memberName.trim();
    setEditMember(null);
    if (!name || name === original) return;
    start(async () => {
      await renameMember({ groupId, memberId, name });
      router.refresh();
    });
  }
  function unlink(memberId: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", groupId);
      fd.set("memberId", memberId);
      await unclaimMember(fd);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {teams.map((team) => {
        const teamMembers = members.filter((m) => m.team_id === team.id);
        return (
          <div key={team.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              {editTeam === team.id ? (
                <input
                  autoFocus
                  value={teamName}
                  maxLength={40}
                  onChange={(e) => setTeamName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTeamName(team.id, team.name);
                    if (e.key === "Escape") setEditTeam(null);
                  }}
                  onBlur={() => saveTeamName(team.id, team.name)}
                  className="input w-auto text-sm"
                />
              ) : (
                <h3 className="font-display font-bold">{team.name}</h3>
              )}
              {editTeam !== team.id && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamName(team.name);
                    setEditTeam(team.id);
                  }}
                  className="text-xs text-cream/35 hover:text-cyan"
                  title="Rename team"
                >
                  ✏️
                </button>
              )}
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {teamMembers.length === 0 && <li className="text-cream/40">No players yet</li>}
              {teamMembers.map((m) => {
                const isCap = m.is_captain || team.captain_member_id === m.id;
                const linked = linkedEmail[m.id];
                return (
                  <li key={m.id}>
                    <div className="flex items-center gap-2">
                      {editMember === m.id ? (
                        <input
                          autoFocus
                          value={memberName}
                          maxLength={40}
                          onChange={(e) => setMemberName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveMemberName(m.id, m.display_name);
                            if (e.key === "Escape") setEditMember(null);
                          }}
                          onBlur={() => saveMemberName(m.id, m.display_name)}
                          className="input w-auto flex-1 text-sm"
                        />
                      ) : (
                        <>
                          <span className="flex-1 truncate">{m.display_name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setMemberName(m.display_name);
                              setEditMember(m.id);
                            }}
                            className="text-cream/35 hover:text-cyan"
                            title="Rename player"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                      {isCap ? (
                        <span className="chip cursor-default text-xs" title="Captain">
                          🎖️
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => makeCaptain(m.id)}
                          disabled={pending}
                          className="text-cream/35 hover:text-gold disabled:opacity-50"
                          title="Make captain"
                        >
                          ★
                        </button>
                      )}
                      <select
                        value={team.id}
                        disabled={pending}
                        onChange={(e) => move(m.id, e.target.value)}
                        className="rounded-lg border border-white/10 bg-ink-soft px-2 py-1 text-xs text-cream outline-none focus:border-magenta disabled:opacity-50"
                        title="Move to team"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {linked && (
                      <div className="mt-1 flex items-center gap-2 pl-0.5 text-xs text-cream/45">
                        <span className="min-w-0 truncate" title={linked}>
                          🔗 {linked}
                        </span>
                        <button
                          type="button"
                          onClick={() => unlink(m.id)}
                          disabled={pending}
                          className="underline hover:text-magenta"
                          title="Unlink this account (frees the name to re-claim)"
                        >
                          unlink
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
