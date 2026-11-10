"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProfileForm } from "@/components/ProfileForm";

/**
 * Member sign-in for the join flow. Primary path: email + password, one button —
 * it signs you in, or (new players) creates your account instantly via
 * /api/auth/register and signs you in, with no email round-trip. A magic-email
 * link is offered as a fallback. Either way you land back here with a session to
 * claim your roster slot.
 */
export function MemberAuth({ code, onAuthed }: { code: string; onAuthed: (email: string) => void }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [collectProfile, setCollectProfile] = useState(false);
  const [authedEmail, setAuthedEmail] = useState("");

  const supabase = createSupabaseBrowserClient();

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em || password.length < 6) {
      setErr("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      // 1) Try signing in (returning players).
      const first = await supabase.auth.signInWithPassword({ email: em, password });
      if (!first.error && first.data.user) return onAuthed(first.data.user.email ?? em);

      // 2) Not a sign-in — create a confirmed account (new players), then sign in.
      const reg = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password, code }),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false, error: "Network error — try again." }));

      if (reg.ok && reg.created) {
        const second = await supabase.auth.signInWithPassword({ email: em, password });
        if (!second.error && second.data.user) {
          // Brand-new account → collect a quick demographic profile before continuing.
          setAuthedEmail(second.data.user.email ?? em);
          setCollectProfile(true);
          return;
        }
        setErr(second.error?.message ?? "Account created — try signing in again.");
      } else if (reg.ok && !reg.created) {
        setErr("That email already has an account — check your password, or use the email link below.");
      } else {
        setErr(reg.error ?? "Couldn't sign you in.");
      }
    } finally {
      setBusy(false);
    }
  }

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(`/join?code=${code}`)}`
      : undefined;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em) {
      setErr("Enter your email.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg(`Check ${em} for a sign-in link — open it and you'll come right back here.`);
  }

  if (collectProfile) {
    return (
      <div className="card p-5">
        <h2 className="text-center font-display text-lg font-bold">You&apos;re in! Tell us a bit about you</h2>
        <p className="mt-1 text-center text-sm text-cream/60">
          Optional — takes 20 seconds, and you can edit it anytime on your home page.
        </p>
        <div className="mt-4">
          <ProfileForm
            onSaved={() => onAuthed(authedEmail)}
            showSkip
            onSkip={() => onAuthed(authedEmail)}
            submitLabel="Save & continue →"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-center font-display text-lg font-bold">Sign in to claim your spot</h2>
      <p className="mt-1 text-center text-sm text-cream/60">
        So only you can see and edit your answers — and you&apos;ll keep your history across games.
      </p>

      {err && (
        <p className="mt-3 rounded-lg border border-magenta/30 bg-magenta/10 px-3 py-2 text-center text-sm text-magenta-soft">
          {err}
        </p>
      )}
      {msg && (
        <p className="mt-3 rounded-lg border border-green/30 bg-green/10 px-3 py-2 text-center text-sm text-green">
          {msg}
        </p>
      )}

      {mode === "password" ? (
        <form onSubmit={handlePassword} className="mt-4 space-y-3">
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Choose a password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "…" : "Continue →"}
          </button>
          <p className="text-center text-xs text-cream/45">
            New here? We&apos;ll create your account automatically — no email to confirm.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode("link");
              setErr(null);
              setMsg(null);
            }}
            className="w-full text-center text-xs text-cream/55 underline hover:text-cream"
          >
            Prefer an email link instead?
          </button>
        </form>
      ) : (
        <form onSubmit={sendLink} className="mt-4 space-y-3">
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Sending…" : "Send me a sign-in link →"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setErr(null);
              setMsg(null);
            }}
            className="w-full text-center text-xs text-cream/55 underline hover:text-cream"
          >
            Use a password instead (instant)
          </button>
        </form>
      )}
    </div>
  );
}
