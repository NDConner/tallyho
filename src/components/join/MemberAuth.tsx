"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Member sign-in for the join flow. Two ways in — a magic email link (no
 * password) or email + password — both land them back in the join flow with a
 * session so they can claim their roster slot. Pure client-side so it stays
 * inside the multi-step flow without a redirect (except the magic-link round
 * trip, which returns via /auth/confirm).
 */
export function MemberAuth({ code, onAuthed }: { code: string; onAuthed: (email: string) => void }) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(`/join?code=${code}`)}`
      : undefined;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setErr("Enter your email.");
    setBusy(true);
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg(`Check ${email.trim()} for a sign-in link — open it and you'll come right back here.`);
  }

  async function withPassword(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6)
      return setErr("Enter your email and a password of at least 6 characters.");
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) return setErr(error.message);
        if (!data.session)
          return setMsg("Account created — check your email to confirm, then come back and sign in.");
        onAuthed(data.user?.email ?? email.trim());
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return setErr(error.message);
        onAuthed(data.user?.email ?? email.trim());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="text-center font-display text-lg font-bold">Sign in to claim your spot</h2>
      <p className="mt-1 text-center text-sm text-cream/60">
        So only you can see and edit your answers — and you&apos;ll keep your history across games.
      </p>

      <div className="mt-4 flex justify-center gap-1.5">
        {(["link", "password"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setErr(null);
              setMsg(null);
            }}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
              (mode === m
                ? "border-magenta bg-magenta/20 text-cream"
                : "border-white/15 bg-white/5 text-cream/70 hover:border-cyan hover:text-cream")
            }
          >
            {m === "link" ? "✉️ Email me a link" : "🔑 Use a password"}
          </button>
        ))}
      </div>

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

      {mode === "link" ? (
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
          <p className="text-center text-xs text-cream/45">No password to remember — we email you a link.</p>
        </form>
      ) : (
        <form onSubmit={withPassword} className="mt-4 space-y-3">
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
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "…" : isSignup ? "Create account →" : "Sign in →"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignup((s) => !s);
              setErr(null);
              setMsg(null);
            }}
            className="w-full text-center text-xs text-cream/55 underline hover:text-cream"
          >
            {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </form>
      )}
    </div>
  );
}
