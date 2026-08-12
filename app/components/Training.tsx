"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  MAX_ACTIVE_TRAINERS,
  type Attribute,
  type AttributeScores,
  useGameStore,
} from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";
import { formatInjuryStatus, rollInjury } from "@/lib/injury";
import { specialtyMultiplier } from "@/lib/trainers";
import ArenaPage from "./ArenaPage";
import AttributeLabel from "./AttributeLabel";
import WrestlerAvatar from "./WrestlerAvatar";

const ATTR_MAX = 20;
const FREE_POINTS = 10;
const ENERGY_COST_PER_POINT = 4;
const FATIGUE_GAIN_PER_POINT = 5;

const emptyAllocation = (): AttributeScores =>
  ATTRIBUTES.reduce(
    (acc, attr) => ({ ...acc, [attr]: 0 }),
    {} as AttributeScores,
  );

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMultiplier(value: number) {
  return `${value.toFixed(2).replace(/\.?0+$/, "")}×`;
}

export default function Training() {
  const wrestler = useGameStore((state) => state.wrestler);
  const hiredTrainers = useGameStore((state) => state.hiredTrainers);
  const applyAttributeGains = useGameStore((state) => state.applyAttributeGains);
  const setWrestler = useGameStore((state) => state.setWrestler);
  const setInjury = useGameStore((state) => state.setInjury);

  const [allocation, setAllocation] = useState<AttributeScores>(emptyAllocation);
  const [sessionPointsLeft, setSessionPointsLeft] = useState(FREE_POINTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(
    "Allocate free points. Hire trainers on the Trainers tab for specialty boosts.",
  );

  const pointsSpent = useMemo(
    () => Object.values(allocation).reduce((sum, n) => sum + n, 0),
    [allocation],
  );
  const remaining = sessionPointsLeft - pointsSpent;
  const staffSlotsLeft = MAX_ACTIVE_TRAINERS - hiredTrainers.length;

  const overall = useMemo(() => {
    const values = Object.values(wrestler.attributes);
    return Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
  }, [wrestler.attributes]);

  const projectedEnergy = clamp(
    wrestler.energy - pointsSpent * ENERGY_COST_PER_POINT,
    0,
    100,
  );

  function adjust(attr: Attribute, delta: number) {
    setAllocation((prev) => {
      const current = prev[attr];
      const nextValue = current + delta;
      if (nextValue < 0) return prev;

      const spentOthers = ATTRIBUTES.reduce(
        (sum, key) => (key === attr ? sum : sum + prev[key]),
        0,
      );
      const maxAddable = sessionPointsLeft - spentOthers;
      const roomOnAttr = ATTR_MAX - wrestler.attributes[attr] - current;
      const capped = Math.min(nextValue, maxAddable, current + Math.max(0, roomOnAttr));

      if (capped === current) return prev;
      return { ...prev, [attr]: capped };
    });
  }

  function clearAllocation() {
    setAllocation(emptyAllocation());
    setStatus("Allocation cleared.");
  }

  async function saveTraining() {
    if (sessionPointsLeft <= 0) {
      setStatus("No free training points left this session.");
      return;
    }
    if (pointsSpent <= 0) {
      setStatus("Allocate at least 1 point before saving.");
      return;
    }
    if (pointsSpent > sessionPointsLeft) {
      setStatus("You allocated more points than you have left.");
      return;
    }
    if (wrestler.energy < pointsSpent * ENERGY_COST_PER_POINT) {
      setStatus("Too gassed to train that hard. Lower your allocation or rest first.");
      return;
    }

    const gains: Partial<AttributeScores> = {};
    const boostNotes: string[] = [];
    for (const attr of ATTRIBUTES) {
      if (allocation[attr] <= 0) continue;
      const mult = specialtyMultiplier(hiredTrainers, attr);
      const boosted = Math.max(1, Math.round(allocation[attr] * mult));
      gains[attr] = boosted;
      if (mult > 1) {
        boostNotes.push(`${attr} ${formatMultiplier(mult)}`);
      }
    }

    applyAttributeGains(gains);

    const latest = useGameStore.getState().wrestler;
    setWrestler({
      energy: clamp(latest.energy - pointsSpent * ENERGY_COST_PER_POINT, 0, 100),
      fatigue: clamp(latest.fatigue + pointsSpent * FATIGUE_GAIN_PER_POINT, 0, 100),
    });

    let injuryNote = "";
    if (!latest.injury) {
      const injury = rollInjury(latest.attributes.Conditioning, "training");
      if (injury) {
        setInjury(injury);
        injuryNote = ` Injury: ${formatInjuryStatus(injury)}.`;
      }
    }

    const left = sessionPointsLeft - pointsSpent;
    setSessionPointsLeft(left);
    setAllocation(emptyAllocation());

    setSaving(true);
    persistGameNow();
    setSaving(false);

    const gainText = Object.entries(gains)
      .map(([attr, n]) => `${attr} +${n}`)
      .join(", ");
    const boostText =
      boostNotes.length > 0 ? ` Trainer boost: ${boostNotes.join(", ")}.` : "";

    setStatus(
      `Saved ${pointsSpent} point${pointsSpent === 1 ? "" : "s"}: ${gainText}.${boostText}${injuryNote} ${left} free left this session.`,
    );
  }

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
            <p className="rwg-label">Training Room</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              Free Allocation
            </h1>
            <p className="mt-1 text-sm text-muted">
              {wrestler.name} · {wrestler.weightClass} lbs · Overall {overall} · Budget $
              {wrestler.budget}
            </p>
          </div>
        </div>
        <p className="rwg-card-inset max-w-md text-sm text-muted" role="status">
          {saving ? "Saving…" : status}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rwg-card-accent px-4 py-4">
          <p className="rwg-label">Remaining</p>
          <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-accent">
            {remaining}
          </p>
          <p className="mt-1 text-xs text-muted">
            of {sessionPointsLeft} free this session · {FREE_POINTS} per visit
          </p>
        </div>
        <div className="rwg-card-inset px-4 py-4">
          <p className="rwg-label">Energy After Save</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
            {projectedEnergy}%
          </p>
          <p className="mt-1 text-xs text-muted">
            −{ENERGY_COST_PER_POINT}% per point · now {wrestler.energy}%
          </p>
        </div>
        <div className="rwg-card-inset px-4 py-4">
          <p className="rwg-label">Staff</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-foreground">
            {hiredTrainers.length}
            <span className="text-lg text-muted">/{MAX_ACTIVE_TRAINERS}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Active trainers · {staffSlotsLeft} slot{staffSlotsLeft === 1 ? "" : "s"} open
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/trainers" className="rwg-btn rwg-btn-ghost">
          Hire Trainers
        </Link>
        <Link href="/school" className="rwg-btn rwg-btn-ghost">
          School & Study
        </Link>
      </div>

      <section className="rwg-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rwg-label">Attributes</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Spend Free Points
            </h2>
            <p className="mt-1 text-sm text-muted">
              Put points into Strength, Speed, Technique, and the rest — then save to
              update the store.
            </p>
          </div>
          <p
            className={`font-display text-2xl font-semibold tabular-nums ${
              remaining === 0 ? "text-accent" : "text-foreground"
            }`}
          >
            {remaining}
            <span className="ml-1 text-sm font-medium text-muted">left</span>
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {ATTRIBUTES.map((attr) => {
            const current = wrestler.attributes[attr];
            const add = allocation[attr];
            const mult = specialtyMultiplier(hiredTrainers, attr);
            const projectedGain =
              add > 0 ? Math.max(1, Math.round(add * mult)) : 0;
            const projected = Math.min(ATTR_MAX, current + projectedGain);
            const atCap = projected >= ATTR_MAX;
            const canAdd = remaining > 0 && !atCap && sessionPointsLeft > 0;
            const canRemove = add > 0;

            return (
              <li key={attr} className="rwg-card-inset px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <AttributeLabel
                      attr={attr}
                      showHint={attr === "Grades"}
                      className="text-sm font-medium text-foreground"
                    />
                    <p className="mt-1 text-xs text-muted" title={ATTRIBUTE_INFO[attr]}>
                      Now {current}
                      {add > 0
                        ? ` → ${projected}${mult > 1 ? ` (${formatMultiplier(mult)})` : ""}`
                        : mult > 1
                          ? ` · Coach ${formatMultiplier(mult)}`
                          : ""}
                      {atCap && add === 0 ? " · Cap" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjust(attr, -1)}
                      disabled={!canRemove}
                      className="rwg-btn rwg-btn-ghost !px-3 !py-2 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove point from ${attr}`}
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center font-display text-xl font-semibold tabular-nums text-accent">
                      +{add}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjust(attr, 1)}
                      disabled={!canAdd}
                      className="rwg-btn rwg-btn-ghost !px-3 !py-2 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Add point to ${attr}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={clearAllocation}
            disabled={pointsSpent === 0}
            className="rwg-btn rwg-btn-ghost flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void saveTraining()}
            disabled={saving || pointsSpent === 0 || sessionPointsLeft <= 0}
            className="rwg-btn rwg-btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : `Save Training (−${pointsSpent || 0} pts)`}
          </button>
        </div>
      </section>
    </ArenaPage>
  );
}
