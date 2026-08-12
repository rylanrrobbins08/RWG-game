"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

type Mode = "login" | "signup";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const configured = isSupabaseConfigured;

  const title = useMemo(
    () => (mode === "login" ? "Welcome Back" : "Create Account"),
    [mode],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!configured) {
      setError("Supabase is not configured. Add keys to .env.local first.");
      return;
    }

    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);

    const result =
      mode === "login"
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);

    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      setInfo("Account created. If email confirmation is on, check your inbox — then log in.");
      setMode("login");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-md border border-panel-border bg-panel/90 p-6 sm:p-8">
      <p className="font-display text-sm uppercase tracking-[0.16em] text-accent">RWG</p>
      <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-wide text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "login"
          ? "Log in to load your wrestler and sync progress."
          : "Sign up to save your career to the cloud."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setInfo(null);
          }}
          className={`rounded-md px-3 py-2 font-display text-sm uppercase tracking-[0.1em] transition ${
            mode === "login"
              ? "bg-accent text-background"
              : "border border-panel-border text-muted hover:text-foreground"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setInfo(null);
          }}
          className={`rounded-md px-3 py-2 font-display text-sm uppercase tracking-[0.1em] transition ${
            mode === "signup"
              ? "bg-accent text-background"
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
            className="rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-foreground outline-none focus:border-accent"
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
            className="rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-foreground outline-none focus:border-accent"
          />
        </label>

        {mode === "signup" && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-muted">
              Confirm Password
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-foreground outline-none focus:border-accent"
            />
          </label>
        )}

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-[#e8a090]">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-md border border-mat/50 bg-mat/20 px-3 py-2 text-sm text-[#8fd4b0]">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !configured}
          className="rounded-md bg-accent px-5 py-3 font-display text-base font-semibold uppercase tracking-[0.08em] text-background transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Please wait…" : mode === "login" ? "Log In" : "Sign Up"}
        </button>
      </form>

      {!configured && (
        <p className="mt-4 text-xs text-muted">
          Copy <code className="text-foreground">.env.local.example</code> to{" "}
          <code className="text-foreground">.env.local</code> and add your Supabase keys.
        </p>
      )}
    </div>
  );
}
