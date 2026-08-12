"use client";

import { useState } from "react";
import {
  MAX_ACTIVE_TRAINERS,
  TRAINER_CATALOG,
  useGameStore,
} from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";

function formatMultiplier(value: number) {
  return `${value.toFixed(2).replace(/\.?0+$/, "")}×`;
}

type TrainerMarketProps = {
  /** Show staff count strip above the list. */
  showStaffSummary?: boolean;
};

/** Hire / release trainers from the shared catalog. */
export default function TrainerMarket({ showStaffSummary = true }: TrainerMarketProps) {
  const wrestler = useGameStore((state) => state.wrestler);
  const hiredTrainers = useGameStore((state) => state.hiredTrainers);
  const hireTrainer = useGameStore((state) => state.hireTrainer);
  const dismissTrainer = useGameStore((state) => state.dismissTrainer);
  const [status, setStatus] = useState<string | null>(null);

  const staffSlotsLeft = MAX_ACTIVE_TRAINERS - hiredTrainers.length;
  const staffFull = staffSlotsLeft <= 0;

  function handleHire(trainerId: string) {
    const result = hireTrainer(trainerId);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    persistGameNow();
    const trainer = TRAINER_CATALOG.find((t) => t.id === trainerId);
    setStatus(
      trainer
        ? `Hired ${trainer.name}. Budget $${useGameStore.getState().wrestler.budget}.`
        : "Trainer hired.",
    );
  }

  function handleDismiss(trainerId: string) {
    dismissTrainer(trainerId);
    persistGameNow();
    const trainer = TRAINER_CATALOG.find((t) => t.id === trainerId);
    setStatus(trainer ? `Released ${trainer.name}.` : "Trainer released.");
  }

  return (
    <section className="rwg-card">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rwg-label">Staff Market</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Available Trainers
          </h2>
          <p className="mt-1 text-sm text-muted">
            Hire up to {MAX_ACTIVE_TRAINERS}. Specialty multipliers boost matching
            attribute gains in training.
          </p>
        </div>
        <p className="font-display text-sm font-semibold tabular-nums text-accent">
          ${wrestler.budget}
          <span className="ml-1 text-xs font-medium text-muted">budget</span>
        </p>
      </div>

      {showStaffSummary && (
        <div className="mb-4 rwg-card-inset px-3 py-3">
          <p className="text-xs uppercase tracking-[0.1em] text-muted">Active staff</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
            {hiredTrainers.length}
            <span className="text-base text-muted">/{MAX_ACTIVE_TRAINERS}</span>
          </p>
        </div>
      )}

      {status && (
        <p className="mb-3 text-sm text-muted" role="status">
          {status}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {TRAINER_CATALOG.map((trainer) => {
          const hired = hiredTrainers.includes(trainer.id);
          const canAfford = wrestler.budget >= trainer.cost;
          const canHire = !hired && !staffFull && canAfford;

          return (
            <li
              key={trainer.id}
              className="rwg-card-inset flex flex-col gap-3 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {trainer.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{trainer.blurb}</p>
                </div>
                <span className="shrink-0 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 font-display text-sm font-semibold tabular-nums text-accent">
                  {formatMultiplier(trainer.multiplier)}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <p>
                  <span className="text-muted">Specialty </span>
                  <span className="font-display font-semibold text-foreground">
                    {trainer.specialty}
                  </span>
                </p>
                <p>
                  <span className="text-muted">Cost </span>
                  <span className="font-display font-semibold tabular-nums text-foreground">
                    ${trainer.cost}
                  </span>
                </p>
              </div>

              {hired ? (
                <button
                  type="button"
                  onClick={() => handleDismiss(trainer.id)}
                  className="rwg-btn rwg-btn-ghost mt-auto w-full !text-xs"
                >
                  Release
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleHire(trainer.id)}
                  disabled={!canHire}
                  title={
                    staffFull
                      ? `Staff full (${MAX_ACTIVE_TRAINERS} max)`
                      : !canAfford
                        ? `Need $${trainer.cost}`
                        : undefined
                  }
                  className="rwg-btn rwg-btn-primary mt-auto w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {staffFull ? "Staff Full" : !canAfford ? "Can't Afford" : "Hire"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
