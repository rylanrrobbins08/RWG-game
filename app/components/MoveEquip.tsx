"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";
import {
  MOVES_PER_POSITION,
  MOVE_POSITIONS,
  POSITION_LABELS,
  getMoveById,
  getUnlockedMoves,
  getMovesForPosition,
  isMoveUnlocked,
  type MovePosition,
} from "@/lib/moves";
import ArenaPage from "./ArenaPage";

export default function MoveEquip() {
  const wrestler = useGameStore((state) => state.wrestler);
  const equippedMoves = useGameStore((state) => state.equippedMoves);
  const setEquippedForPosition = useGameStore((state) => state.setEquippedForPosition);

  const [position, setPosition] = useState<MovePosition>("neutral");
  const [draft, setDraft] = useState<string[]>(equippedMoves.neutral);
  const [status, setStatus] = useState(
    "Select exactly 4 unlocked moves for each position, then save.",
  );

  const technique = wrestler.attributes.Technique;

  const unlocked = useMemo(
    () => getUnlockedMoves(position, technique),
    [position, technique],
  );

  const allForPosition = useMemo(
    () => getMovesForPosition(position),
    [position],
  );

  function switchPosition(next: MovePosition) {
    setPosition(next);
    setDraft(equippedMoves[next]);
    setStatus(`Editing ${POSITION_LABELS[next]} loadout.`);
  }

  function toggleMove(moveId: string) {
    setDraft((prev) => {
      if (prev.includes(moveId)) {
        return prev.filter((id) => id !== moveId);
      }
      if (prev.length >= MOVES_PER_POSITION) {
        setStatus(`Only ${MOVES_PER_POSITION} moves can be equipped per position.`);
        return prev;
      }
      return [...prev, moveId];
    });
  }

  function saveLoadout() {
    if (draft.length !== MOVES_PER_POSITION) {
      setStatus(`Equip exactly ${MOVES_PER_POSITION} moves before saving.`);
      return;
    }

    const invalid = draft.some((id) => {
      const move = getMoveById(id);
      return !move || move.position !== position || !isMoveUnlocked(move, technique);
    });

    if (invalid) {
      setStatus("One or more selected moves are locked or invalid.");
      return;
    }

    setEquippedForPosition(position, draft);
    persistGameNow();
    setStatus(
      `Saved ${POSITION_LABELS[position]} loadout (${draft.length}/${MOVES_PER_POSITION}).`,
    );
  }

  const savedForPosition = equippedMoves[position];
  const draftDirty =
    draft.length !== savedForPosition.length ||
    draft.some((id, index) => id !== savedForPosition[index]);

  return (
    <ArenaPage>
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rwg-label">Move Lab</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              Equip Moves
            </h1>
            <p className="mt-1 text-sm text-muted">
              {wrestler.name} · Technique {technique} unlocks higher-level moves
            </p>
          </div>
          <p className="rwg-card-inset max-w-md text-sm text-muted" role="status">
            {status}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2">
          {MOVE_POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => switchPosition(pos)}
              className={`rounded-md border px-3 py-3 font-display text-sm uppercase tracking-[0.1em] transition ${
                position === pos
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-panel-border bg-panel text-muted hover:text-foreground"
              }`}
            >
              {POSITION_LABELS[pos]}
              <span className="mt-1 block text-[10px] normal-case tracking-normal opacity-80">
                {equippedMoves[pos].length}/{MOVES_PER_POSITION} saved
              </span>
            </button>
          ))}
        </div>

        <section className="rounded-md border border-accent/40 bg-accent/10 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.14em] text-accent">
                Equipped · {POSITION_LABELS[position]}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                {draft.length}/{MOVES_PER_POSITION} selected
              </h2>
            </div>
            <button
              type="button"
              onClick={saveLoadout}
              disabled={!draftDirty && draft.length === MOVES_PER_POSITION}
              className="rounded-md bg-accent px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save Loadout
            </button>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: MOVES_PER_POSITION }, (_, index) => {
              const id = draft[index];
              const move = id ? getMoveById(id) : null;
              return (
                <li
                  key={`slot-${index}`}
                  className="rounded-md border border-panel-border bg-background/40 px-3 py-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                    Slot {index + 1}
                  </p>
                  <p className="mt-1 font-display text-base font-semibold text-foreground">
                    {move?.name ?? "Empty"}
                  </p>
                  {move && (
                    <p className="mt-0.5 text-xs text-muted">
                      Scales with {move.primary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-md border border-panel-border bg-panel/80 p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.14em] text-muted">
                Unlocked Pool
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                {POSITION_LABELS[position]} Moves
              </h2>
            </div>
            <p className="text-sm text-muted">
              {unlocked.length} unlocked · {allForPosition.length - unlocked.length} locked
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {allForPosition.map((move) => {
              const unlockedMove = isMoveUnlocked(move, technique);
              const selected = draft.includes(move.id);

              return (
                <li key={move.id}>
                  <button
                    type="button"
                    disabled={!unlockedMove}
                    onClick={() => toggleMove(move.id)}
                    className={`h-full w-full rounded-md border px-4 py-3 text-left transition ${
                      !unlockedMove
                        ? "cursor-not-allowed border-panel-border/50 bg-background/20 opacity-45"
                        : selected
                          ? "border-accent bg-accent/15"
                          : "border-panel-border bg-background/40 hover:border-accent/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-base font-semibold text-foreground">
                        {move.name}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                        {unlockedMove ? (selected ? "Equipped" : "Available") : "Locked"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{move.description}</p>
                    <p className="mt-2 text-xs text-muted">
                      {move.primary}
                      {!unlockedMove && ` · Needs Technique ${move.unlockTechnique}`}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/calendar"
            className="rounded-md border border-accent/50 bg-accent px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition hover:bg-accent-hover"
          >
            Calendar / Match
          </Link>
          <Link
            href="/upgrades"
            className="rounded-md border border-panel-border bg-panel px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-accent/50"
          >
            Upgrade Moves
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-panel-border bg-panel px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-accent/50"
          >
            Back to Dashboard
          </Link>
        </div>
    </ArenaPage>
  );
}
