"use client";

import { useState } from "react";
import {
  SCHOOL_ACTIONS,
  nextLetterGrade,
  useGameStore,
} from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";

type SchoolStudyProps = {
  compact?: boolean;
};

/** Study / school actions that push letter grade toward A. */
export default function SchoolStudy({ compact = false }: SchoolStudyProps) {
  const wrestler = useGameStore((state) => state.wrestler);
  const performSchoolAction = useGameStore((state) => state.performSchoolAction);
  const [status, setStatus] = useState<string | null>(null);

  const next = nextLetterGrade(wrestler.grade);
  const atTop = next === null;

  function handleAction(actionId: (typeof SCHOOL_ACTIONS)[number]["id"]) {
    const result = performSchoolAction(actionId);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    persistGameNow();
    if (result.upgraded) {
      setStatus(`Transcript updated — Grade ${result.grade}.`);
    } else {
      setStatus(
        `Studied. Progress ${result.studyProgress}/100 toward Grade ${next}.`,
      );
    }
  }

  return (
    <section className={compact ? "rwg-card !p-4" : "rwg-card"}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rwg-label">Academics</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            School & Study
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-muted">
              New wrestlers start at Grade B. Study to climb toward A for recruiting.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-semibold text-accent">
            {wrestler.grade}
          </p>
          <p className="text-xs text-muted">
            {atTop ? "Max grade" : `Next: ${next}`}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
          <span>Study progress</span>
          <span className="font-display font-semibold tabular-nums text-foreground">
            {atTop ? "—" : `${wrestler.studyProgress}/100`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: atTop ? "100%" : `${wrestler.studyProgress}%` }}
          />
        </div>
      </div>

      {status && (
        <p className="mb-3 text-sm text-muted" role="status">
          {status}
        </p>
      )}

      <ul className={`grid gap-3 ${compact ? "" : "sm:grid-cols-3"}`}>
        {SCHOOL_ACTIONS.map((action) => {
          const canAfford = wrestler.budget >= action.budget;
          const hasEnergy = wrestler.energy >= action.energy;
          const disabled = atTop || !canAfford || !hasEnergy;
          const costBits = [
            action.budget > 0 ? `$${action.budget}` : null,
            `−${action.energy}% energy`,
            action.fatigue > 0 ? `+${action.fatigue}% fatigue` : null,
            `+${action.progress} prog`,
          ].filter(Boolean);

          return (
            <li
              key={action.id}
              className="rwg-card-inset flex flex-col gap-2 px-3 py-3"
            >
              <div>
                <p className="font-display text-base font-semibold text-foreground">
                  {action.name}
                </p>
                <p className="mt-0.5 text-xs text-muted">{action.description}</p>
                <p className="mt-1 text-[11px] text-muted">{costBits.join(" · ")}</p>
              </div>
              <button
                type="button"
                onClick={() => handleAction(action.id)}
                disabled={disabled}
                className="rwg-btn rwg-btn-primary mt-auto w-full !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                {atTop
                  ? "Maxed"
                  : !canAfford
                    ? "Can't Afford"
                    : !hasEnergy
                      ? "Too Tired"
                      : action.name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
