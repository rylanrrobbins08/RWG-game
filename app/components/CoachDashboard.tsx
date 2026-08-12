"use client";

import Link from "next/link";
import { useGameStore } from "@/lib/game-store";
import ArenaPage from "./ArenaPage";
import WrestlerAvatar from "./WrestlerAvatar";

export default function CoachDashboard() {
  const wrestler = useGameStore((state) => state.wrestler);
  const careerMode = useGameStore((state) => state.careerMode);
  const season = useGameStore((state) => state.season);

  const isCoach = careerMode === "coach";

  return (
    <ArenaPage>
      <header className="flex items-start gap-4">
        <WrestlerAvatar name={wrestler.name} size="lg" />
        <div>
          <p className="rwg-label">Post-Olympic Career</p>
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            Coach Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isCoach
              ? `Coach ${wrestler.name} · Season ${season}`
              : "Athlete career still active — retire from the main dashboard to unlock coaching."}
          </p>
        </div>
      </header>

      <section className="rwg-card-accent p-5 sm:p-6">
        <p className="font-display text-xs uppercase tracking-[0.14em] text-accent">
          Coming Soon
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
          Coach Career Mode
        </h2>
        <p className="mt-3 max-w-xl text-sm text-muted">
          After the Olympic cycle, hang up the shoes and build the next generation.
          Recruit athletes, run a room, and climb the coaching ranks — this is a stub
          placeholder for that path.
        </p>
      </section>

      <section className="rwg-card">
        <p className="rwg-label">Placeholder Tools</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { title: "Recruiting", detail: "Scout high school talent" },
            { title: "Room Staff", detail: "Hire assistants & trainers" },
            { title: "Team Duals", detail: "Schedule program matches" },
          ].map((item) => (
            <li key={item.title} className="rwg-card-inset px-4 py-4 opacity-70">
              <p className="font-display text-base font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-sm text-muted">{item.detail}</p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-muted">
                Locked
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
          Athlete Dashboard
        </Link>
      </div>
    </ArenaPage>
  );
}
