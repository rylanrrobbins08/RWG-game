"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_CAREERS,
  type CareerListItem,
} from "@/lib/career-slots";
import {
  prepareCareerStorage,
  loadCareerIntoStore,
  hydrateCareerFromSavedGame,
  mergeSavedGameIntoSlots,
} from "@/lib/local-save";
import { formatHometown } from "@/lib/wrestler-profile";
import { useGameStore } from "@/lib/game-store";
import { savedGameToListItem, type SavedGame } from "@/lib/wrestlers";
import WrestlerAvatar from "./WrestlerAvatar";

/** First screen after load — pick a career slot or create a new wrestler. */
export default function WrestlerSelect({
  initialWrestlers = [],
  loadError = null,
}: {
  initialWrestlers?: SavedGame[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const clearCareerSelection = useGameStore(
    (state) => state.clearCareerSelection,
  );
  const [careers, setCareers] = useState<CareerListItem[]>(() =>
    initialWrestlers.map(savedGameToListItem),
  );
  const [cloudById, setCloudById] = useState<Record<string, SavedGame>>(() => {
    const byId: Record<string, SavedGame> = {};
    for (const saved of initialWrestlers) byId[saved.id] = saved;
    return byId;
  });
  const [ready, setReady] = useState(initialWrestlers.length > 0 || Boolean(loadError));
  const [error, setError] = useState<string | null>(loadError);

  useEffect(() => {
    prepareCareerStorage();
    clearCareerSelection();

    for (const saved of initialWrestlers) {
      mergeSavedGameIntoSlots(saved);
    }

    setCloudById(
      Object.fromEntries(initialWrestlers.map((saved) => [saved.id, saved])),
    );
    setCareers(initialWrestlers.map(savedGameToListItem));
    setError(loadError);
    setReady(true);
  }, [clearCareerSelection, initialWrestlers, loadError]);

  const canCreate = careers.length < MAX_CAREERS;

  async function handleSelect(careerId: string) {
    setError(null);
    const cloud = cloudById[careerId];
    const ok = cloud
      ? hydrateCareerFromSavedGame(cloud)
      : loadCareerIntoStore(careerId);
    if (!ok) {
      setError("Could not load that career. Try another wrestler.");
      setCareers(initialWrestlers.map(savedGameToListItem));
      return;
    }
    router.push("/dashboard");
  }

  function handleCreate() {
    if (!canCreate) {
      setError(`You can have at most ${MAX_CAREERS} wrestlers.`);
      return;
    }
    router.push("/create");
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#123056_0%,_transparent_55%),linear-gradient(160deg,_#0c0e12_0%,_#12161f_45%,_#0c0e12_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 47px, #2f7bff 47px, #2f7bff 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, #2f7bff 47px, #2f7bff 48px)",
        }}
      />

      <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <header className="text-center sm:text-left">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-accent">
            RWG
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-wide text-foreground sm:text-5xl">
            Select Wrestler
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted sm:text-base">
            Choose a career to continue, or create a new athlete. You can keep
            up to {MAX_CAREERS} wrestlers.
          </p>
        </header>

        {error && (
          <p className="rwg-card-inset text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {!ready ? (
          <p className="text-sm text-muted">Loading wrestlers…</p>
        ) : careers.length === 0 ? (
          <section className="rwg-card text-center sm:text-left">
            <p className="rwg-label">Empty room</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
              No wrestlers yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Create your first athlete to start a career.
            </p>
            <button
              type="button"
              onClick={handleCreate}
              className="rwg-btn rwg-btn-primary mt-5"
            >
              Create New Wrestler
            </button>
          </section>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {careers.map((career) => {
              const location = formatHometown(career.hometown, career.state);
              return (
                <li key={career.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(career.id)}
                    className="rwg-card flex w-full items-start gap-4 text-left transition hover:border-accent/60"
                  >
                    <WrestlerAvatar
                      name={career.name}
                      weightClass={career.weightClass}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl font-semibold uppercase tracking-wide text-foreground">
                        {career.name}
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        {career.weightClass} lbs · {location}
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        Record {career.record.wins}-{career.record.losses} ·
                        Season {career.season} · Week {career.week}
                      </span>
                      {career.careerMode === "coach" && (
                        <span className="mt-2 inline-block text-[10px] uppercase tracking-[0.12em] text-accent">
                          Coach mode
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {ready && careers.length > 0 && (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {careers.length} of {MAX_CAREERS} careers used
            </p>
            {canCreate ? (
              <button
                type="button"
                onClick={handleCreate}
                className="rwg-btn rwg-btn-primary"
              >
                Create New Wrestler
              </button>
            ) : (
              <p className="text-sm text-muted">
                Career limit reached ({MAX_CAREERS}).
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
