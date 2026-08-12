import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "../components/AuthForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in or sign up to play RWG.",
};

export default function AuthPage() {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a3d2e_0%,_transparent_50%),linear-gradient(160deg,_#0c0e12_0%,_#12161f_45%,_#0c0e12_100%)]"
      />
      <div className="relative w-full max-w-md">
        <Suspense
          fallback={
            <div className="rounded-md border border-panel-border bg-panel/90 p-8 text-sm text-muted">
              Loading…
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
