"use client";

import { FormEvent, useState } from "react";
import { signInWithEmail, signUpWithEmail } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

type Mode = "login" | "signup";

const CONFIG_MESSAGE =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the app.";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured;

  function goToWrestlerSelect() {
    window.location.assign("/");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!configured) {
      setError(CONFIG_MESSAGE);
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const created = await signUpWithEmail(trimmedEmail, password);
        if (!created.ok) {
          setError(created.error);
          return;
        }
        if (created.session) {
          goToWrestlerSelect();
          return;
        }

        const signedIn = await signInWithEmail(trimmedEmail, password);
        if (signedIn.ok && signedIn.session) {
          goToWrestlerSelect();
          return;
        }

        setError(
          signedIn.ok
            ? "Account created. Confirm your email, then log in."
            : signedIn.error,
        );
        setMode("login");
        return;
      }

      const result = await signInWithEmail(trimmedEmail, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      goToWrestlerSelect();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-md border border-panel-border bg-panel/90 p-6 sm:p-8">
      <p className="font-display text-sm uppercase tracking-[0.16em] text-accent">RWG</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-wide text-foreground">
        Login / Sign Up
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "login"
          ? "Enter your email and password to play."
          : "Create an account to save your wrestlers."}
      </p>

      {!configured && (
        <p
          role="status"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-3 text-sm text-danger-soft"
        >
          {CONFIG_MESSAGE}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`rounded-md px-3 py-2 font-display text-sm uppercase tracking-[0.1em] transition ${
            mode === "login"
              ? "bg-accent text-accent-foreground"
              : "border border-panel-border text-muted hover:text-foreground"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`rounded-md px-3 py-2 font-display text-sm uppercase tracking-[0.1em] transition ${
            mode === "signup"
              ? "bg-accent text-accent-foreground"
              : "border border-panel-border text-muted hover:text-foreground"
          }`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-display text-xs uppercase tracking-[0.12em] text-muted">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@email.com"
            className="rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-foreground outline-none placeholder:text-muted/60 focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-display text-xs uppercase tracking-[0.12em] text-muted">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="At least 6 characters"
            className="rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-foreground outline-none placeholder:text-muted/60 focus:border-accent"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger-soft"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !configured}
          className="rounded-md bg-accent px-5 py-3 font-display text-base font-semibold uppercase tracking-[0.08em] text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </form>
    </div>
  );
}
