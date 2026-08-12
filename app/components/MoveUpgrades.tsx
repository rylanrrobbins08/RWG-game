"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";
import {
  MOVE_MAX_LEVEL,
  POSITION_LABELS,
  UPGRADABLE_MOVE_IDS,
  UPGRADE_COST,
  costToUpgrade,
  getMoveById,
  getMoveLevel,
} from "@/lib/moves";
import ArenaPage from "./ArenaPage";

export default function MoveUpgrades() {
  const wrestler = useGameStore((state) => state.wrestler);
  const moveLevels = useGameStore((state) => state.moveLevels);
  const upgradeMove = useGameStore((state) => state.upgradeMove);
  const [status, setStatus] = useState(
    "Spend budget to raise moves from Level 1 → 2 → 3.",
  );

  function handleUpgrade(moveId: string) {
    const before = getMoveLevel(moveLevels, moveId);
    const cost = costToUpgrade(before);
    const result = upgradeMove(moveId);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    persistGameNow();
    setStatus(
      `Upgraded ${getMoveById(moveId)?.name ?? "move"} to Level ${result.level} (−$${cost}).`,
    );
  }

  return (
    <ArenaPage>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rwg-label">Move Lab</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              Move Upgrades
            </h1>
            <p className="mt-1 text-sm text-muted">
              Budget{" "}
              <span className="font-display font-semibold text-accent">
                ${wrestler.budget.toLocaleString()}
              </span>
              {" · "}
              L2 ${UPGRADE_COST[2]} · L3 ${UPGRADE_COST[3]}
            </p>
          </div>
          <p className="rwg-card-inset max-w-md text-sm text-muted" role="status">
            {status}
          </p>
        </header>

        <ul className="flex flex-col gap-3">
          {UPGRADABLE_MOVE_IDS.map((id) => {
            const move = getMoveById(id);
            if (!move) return null;

            const level = getMoveLevel(moveLevels, id);
            const cost = costToUpgrade(level);
            const maxed = level >= MOVE_MAX_LEVEL;

            return (
              <li key={id} className="rwg-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">
                      {move.name}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {POSITION_LABELS[move.position]} · {move.primary} ·{" "}
                      {move.description}
                    </p>
                    <p className="mt-2 font-display text-sm uppercase tracking-[0.1em] text-accent">
                      Level {level}
                      {maxed ? " · Max" : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {([1, 2, 3] as const).map((tier) => {
                      const reached = level >= tier;
                      const isNext = !maxed && cost !== null && tier === level + 1;
                      const locked = tier > level + 1;

                      return (
                        <button
                          key={tier}
                          type="button"
                          disabled={!isNext}
                          onClick={() => handleUpgrade(id)}
                          className={`rounded-md border px-3 py-2 font-display text-sm font-semibold uppercase tracking-[0.08em] transition ${
                            reached && !isNext
                              ? "border-accent/50 bg-accent/15 text-accent"
                              : isNext
                                ? "border-accent bg-accent text-accent-foreground hover:bg-accent-hover"
                                : locked
                                  ? "cursor-not-allowed border-panel-border/50 bg-background/20 text-muted opacity-50"
                                  : "border-panel-border bg-background/40 text-muted"
                          }`}
                        >
                          {reached && !isNext
                            ? `Lv ${tier}`
                            : isNext
                              ? `Upgrade → ${tier} (−$${cost})`
                              : `Lv ${tier}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-3">
          <Link href="/moves" className="rwg-btn rwg-btn-primary">
            Equip Moves
          </Link>
          <Link href="/dashboard" className="rwg-btn rwg-btn-ghost">
            Dashboard
          </Link>
        </div>
    </ArenaPage>
  );
}
