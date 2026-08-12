"use client";

import Link from "next/link";
import { MAX_ACTIVE_TRAINERS, useGameStore } from "@/lib/game-store";
import ArenaPage from "./ArenaPage";
import TrainerMarket from "./TrainerMarket";
import WrestlerAvatar from "./WrestlerAvatar";

export default function TrainersPage() {
  const wrestler = useGameStore((state) => state.wrestler);
  const hiredTrainers = useGameStore((state) => state.hiredTrainers);

  return (
    <ArenaPage>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <WrestlerAvatar
            name={wrestler.name}
            weightClass={wrestler.weightClass}
            size="md"
          />
          <div>
            <p className="rwg-label">Coaching Staff</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              Trainers
            </h1>
            <p className="mt-1 text-sm text-muted">
              Hire specialists to multiply training gains ·{" "}
              {hiredTrainers.length}/{MAX_ACTIVE_TRAINERS} active · Budget $
              {wrestler.budget}
            </p>
          </div>
        </div>
      </header>

      <TrainerMarket />

      <div className="flex flex-wrap gap-3">
        <Link href="/training" className="rwg-btn rwg-btn-primary">
          Go Train
        </Link>
        <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
          Dashboard
        </Link>
      </div>
    </ArenaPage>
  );
}
