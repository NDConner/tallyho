"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface ProfileData {
  username: string;
  full_name: string;
  age_range: string;
  gender: string;
  location: string;
  interests: string;
  occupation: string;
}

const EMPTY: ProfileData = {
  username: "",
  full_name: "",
  age_range: "",
  gender: "",
  location: "",
  interests: "",
  occupation: "",
};

const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"];
const GENDERS = ["Male", "Female", "Prefer not to say"];

/** Demographic profile editor. Saves the signed-in user's own row (RLS). Used in
 *  the join sign-up flow (new players) and on /me (edit any time). */
export function ProfileForm({
  initial,
  onSaved,
  showSkip = false,
  onSkip,
  submitLabel = "Save profile",
}: {
  initial?: Partial<ProfileData>;
  onSaved?: () => void;
  showSkip?: boolean;
  onSkip?: () => void;
  submitLabel?: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const [p, setP] = useState<ProfileData>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof ProfileData) => (e: { target: { value: string } }) => {
    setP((prev) => ({ ...prev, [k]: e.target.value }));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setErr(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("Please sign in again.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      username: p.username.trim() || null,
      full_name: p.full_name.trim() || null,
      age_range: p.age_range || null,
      gender: p.gender || null,
      location: p.location.trim() || null,
      interests: p.interests.trim() || null,
      occupation: p.occupation.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSaved(true);
    onSaved?.();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Username</span>
          <input className="input mt-1" value={p.username} onChange={set("username")} maxLength={40} placeholder="e.g. court_jester" />
        </label>
        <label className="block">
          <span className="label">Full name</span>
          <input className="input mt-1" value={p.full_name} onChange={set("full_name")} maxLength={80} placeholder="Jordan Rivera" />
        </label>
        <label className="block">
          <span className="label">Age range</span>
          <select className="input mt-1" value={p.age_range} onChange={set("age_range")}>
            <option value="">Prefer not to say</option>
            {AGE_RANGES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Gender</span>
          <select className="input mt-1" value={p.gender} onChange={set("gender")}>
            <option value="">Prefer not to say</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Location</span>
          <input className="input mt-1" value={p.location} onChange={set("location")} maxLength={80} placeholder="City, State / Country" />
        </label>
        <label className="block">
          <span className="label">Occupation</span>
          <input className="input mt-1" value={p.occupation} onChange={set("occupation")} maxLength={80} placeholder="e.g. Teacher" />
        </label>
      </div>
      <label className="block">
        <span className="label">Interests</span>
        <input
          className="input mt-1"
          value={p.interests}
          onChange={set("interests")}
          maxLength={200}
          placeholder="Comma-separated — e.g. skiing, cooking, football, travel"
        />
      </label>

      {err && <p className="text-sm text-magenta">{err}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-primary text-sm">
          {busy ? "Saving…" : saved ? "Saved ✓" : submitLabel}
        </button>
        {showSkip && (
          <button onClick={() => onSkip?.()} className="text-sm text-cream/55 underline hover:text-cream">
            Skip for now
          </button>
        )}
      </div>
      <p className="text-xs text-cream/40">
        Optional, and only shared with your host and Tallyho. Helps tailor games and understand the
        crowd.
      </p>
    </div>
  );
}
