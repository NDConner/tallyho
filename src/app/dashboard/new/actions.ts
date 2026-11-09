"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateJoinCode, shuffle, partition } from "@/lib/utils";
import type { GroupCategory, TeamAssignment } from "@/lib/types";

export interface CreateGroupInput {
  name: string;
  category: GroupCategory;
  categoryCustomDesc?: string;
  dynamicNote: string;
  numTeams: number;
  teamAssignment: TeamAssignment;
  members: { name: string; teamIndex: number | null }[];
}

export type CreateGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; error: string };

export async function createGroup(input: CreateGroupInput): Promise<CreateGroupResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const name = input.name.trim();
  const members = input.members
    .map((m) => ({ name: m.name.trim(), teamIndex: m.teamIndex }))
    .filter((m) => m.name.length > 0);

  if (!name) return { ok: false, error: "Give your group a name." };
  if (members.length < 2) return { ok: false, error: "Add at least 2 members." };
  const numTeams = Math.max(2, Math.min(4, input.numTeams || 2));

  // 1) Insert the group with a unique join code (retry on collision).
  let groupId: string | null = null;
  for (let attempt = 0; attempt < 6 && !groupId; attempt++) {
    const join_code = generateJoinCode(6);
    const { data, error } = await supabase
      .from("groups")
      .insert({
        created_by: user.id,
        name,
        category: input.category,
        category_custom_desc:
          input.category === "custom" ? input.categoryCustomDesc?.trim() || null : null,
        dynamic_note: input.dynamicNote.trim(),
        num_teams: numTeams,
        num_rounds: 1,
        team_assignment: input.teamAssignment,
        join_code,
        status: "setup",
        require_member_login: true, // new groups are secure by default; host can toggle off
      })
      .select("id")
      .single();

    if (!error && data) {
      groupId = data.id;
      break;
    }
    if (error && error.code !== "23505") {
      return { ok: false, error: error.message };
    }
    // 23505 = unique violation on join_code -> retry with a new code
  }
  if (!groupId) {
    return { ok: false, error: "Could not generate a unique join code. Please try again." };
  }

  // 2) Create teams.
  const teamRows = Array.from({ length: numTeams }, (_, i) => ({
    group_id: groupId,
    name: `Team ${i + 1}`,
    team_index: i,
  }));
  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .insert(teamRows)
    .select("id, team_index");
  if (teamErr || !teams) {
    return { ok: false, error: teamErr?.message ?? "Failed to create teams." };
  }
  const teamByIndex = new Map<number, string>();
  teams.forEach((t) => teamByIndex.set(t.team_index, t.id));

  // 3) Assign members to teams (admin-provided or random partition).
  let assignment: { name: string; teamId: string }[];
  const adminAssigned =
    input.teamAssignment === "admin" && members.every((m) => m.teamIndex !== null);
  if (adminAssigned) {
    assignment = members.map((m) => ({
      name: m.name,
      teamId: teamByIndex.get((m.teamIndex as number) % numTeams)!,
    }));
  } else {
    const buckets = partition(shuffle(members), numTeams);
    assignment = [];
    buckets.forEach((bucket, idx) => {
      bucket.forEach((m) => assignment.push({ name: m.name, teamId: teamByIndex.get(idx)! }));
    });
  }

  // 4) Insert members.
  const { data: insertedMembers, error: memErr } = await supabase
    .from("members")
    .insert(
      assignment.map((a) => ({
        group_id: groupId,
        display_name: a.name,
        team_id: a.teamId,
        is_captain: false,
      })),
    )
    .select("id, team_id");
  if (memErr || !insertedMembers) {
    return { ok: false, error: memErr?.message ?? "Failed to add members." };
  }

  // 5) Pick one captain per team (random) and record it both ways.
  const byTeam = new Map<string, string[]>();
  insertedMembers.forEach((m) => {
    const arr = byTeam.get(m.team_id) ?? [];
    arr.push(m.id);
    byTeam.set(m.team_id, arr);
  });
  for (const [teamId, memberIds] of byTeam) {
    const captainId = memberIds[Math.floor(Math.random() * memberIds.length)];
    await supabase.from("members").update({ is_captain: true }).eq("id", captainId);
    await supabase.from("teams").update({ captain_member_id: captainId }).eq("id", teamId);
  }

  return { ok: true, groupId };
}
