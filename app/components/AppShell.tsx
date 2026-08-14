"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initGameSync } from "@/lib/game-sync";
import { signOut, storeAuthUserId } from "@/lib/supabase/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useGameStore } from "@/lib/game-store";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wrestler", label: "Wrestler" },
  { href: "/training", label: "Training" },
  { href: "/calendar", label: "Calendar" },
  { href: "/league", label: "League" },
  { href: "/match", label: "Matches" },
] as const;

function NavIcon({ href }: { href: string }) {
  const className = "h-5 w-5";

  switch (href) {
    case "/dashboard":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "/wrestler":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
        </svg>
      );
    case "/training":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M7 8h10M7 16h10M4 12h16M9 5v14M15 5v14" />
        </svg>
      );
    case "/calendar":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="4" y="5" width="16" height="15" rx="1.5" />
          <path d="M8 3.5V7M16 3.5V7M4 10h16" />
        </svg>
      );
    case "/league":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M7 19V9.5L12 5l5 4.5V19" />
          <path d="M10 19v-5h4v5" />
        </svg>
      );
    case "/match":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="8" cy="12" r="3.25" />
          <circle cx="16" cy="12" r="3.25" />
          <path d="M11.25 12h1.5" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSelectFlow(pathname: string) {
  return pathname === "/" || pathname === "/create" || pathname.startsWith("/create/");
}

/** Persistent bottom navigation shell — mounted from root layout. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const userId = useGameStore((state) => state.userId);
  const careerSelected = useGameStore((state) => state.careerSelected);
  const [email, setEmail] = useState<string | null>(null);
  const isAuthPage = pathname === "/auth" || pathname.startsWith("/auth/");
  const onSelectFlow = isSelectFlow(pathname);
  const showGameChrome = !isAuthPage && !onSelectFlow && careerSelected;

  useEffect(() => {
    if (isAuthPage) return;
    initGameSync();
  }, [isAuthPage]);

  useEffect(() => {
    if (isAuthPage || onSelectFlow) return;
    if (!careerSelected) {
      router.replace("/");
    }
  }, [careerSelected, isAuthPage, onSelectFlow, router]);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      storeAuthUserId(data.user?.id ?? null);
    }).catch((error) => {
      console.error("Auth check failed:", error);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      storeAuthUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await signOut();
    setEmail(null);
    window.location.assign("/auth");
  }

  if (isAuthPage) {
    return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
  }

  if (onSelectFlow || !careerSelected) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-background">
        {isSupabaseConfigured && (
          <div className="flex items-center justify-end gap-2 px-4 py-2 sm:px-8">
            {email && (
              <span className="max-w-[14rem] truncate text-xs text-muted">
                {email}
              </span>
            )}
            {userId || email ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-md border border-danger/50 bg-danger/15 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.1em] text-danger-soft transition hover:border-danger hover:bg-danger/25"
              >
                Logout
              </button>
            ) : (
              <Link href="/auth" className="rwg-btn rwg-btn-primary !px-2.5 !py-1 !text-[10px]">
                Log In
              </Link>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-accent/20 bg-background/90 shadow-[0_1px_0_color-mix(in_srgb,var(--accent)_12%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link
            href="/dashboard"
            className="font-display text-xl font-bold tracking-[0.16em] text-accent transition hover:text-accent-hover"
          >
            RWG
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="rounded-md border border-panel-border px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.1em] text-muted transition hover:border-accent/50 hover:text-foreground"
            >
              Careers
            </Link>
            <Link
              href="/settings"
              className={`rounded-md border px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.1em] transition ${
                pathname === "/settings" || pathname.startsWith("/settings/")
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-panel-border text-muted hover:border-accent/50 hover:text-foreground"
              }`}
            >
              Profile
            </Link>
            {isSupabaseConfigured && email && (
              <span className="hidden max-w-[10rem] truncate text-xs text-muted sm:inline">
                {email}
              </span>
            )}
            {isSupabaseConfigured && (userId || email) && (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-md border border-danger/50 bg-danger/15 px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.1em] text-danger-soft transition hover:border-danger hover:bg-danger/25"
              >
                Logout
              </button>
            )}
            {isSupabaseConfigured && !userId && !email && (
              <Link href="/auth" className="rwg-btn rwg-btn-primary !px-2.5 !py-1 !text-[10px]">
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col pb-[4.5rem]">{children}</div>

      {showGameChrome && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-accent/20 bg-background/95 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md"
        >
          <ul className="mx-auto grid max-w-3xl grid-cols-6 px-2 pb-[env(safe-area-inset-bottom)] pt-1">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href} className="min-w-0">
                  <Link
                    href={href}
                    className={`flex h-full flex-col items-center justify-center gap-1 rounded-md px-1 py-2.5 transition ${
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <NavIcon href={href} />
                    <span className="w-full truncate text-center font-display text-[10px] font-medium uppercase tracking-[0.06em]">
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
