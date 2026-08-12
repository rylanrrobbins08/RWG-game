"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_CAREERS,
  listCareers,
  retainCareerSlots,
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

function toListItems(savedGames: SavedGame[]): CareerListItem[] {
  const items: CareerListItem[] = [];
  for (const saved of savedGames) {
    try {
      if (!saved?.id || !saved.wrestler?.name) continue;
      items.push(savedGameToListItem(saved));
    } catch (error) {
      console.warn("Skipping invalid wrestler row:", error);
    }
  }
  return items;
}

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
    toListItems(initialWrestlers),
  );
  const [cloudById, setCloudById] = useState<Record<string, SavedGame>>(() => {
    const byId: Record<string, SavedGame> = {};
    for (const saved of initialWrestlers) byId[saved.id] = saved;
    return byId;
  });
  const [error, setError] = useState<string | null>(loadError);

  useEffect(() => {
    try {
      prepareCareerStorage();
      clearCareerSelection();

      const byId: Record<string, SavedGame> = {};
      for (const saved of initialWrestlers) byId[saved.id] = saved;
      setCloudById(byId);

      if (!loadError) {
        for (const saved of initialWrestlers) {
          mergeSavedGameIntoSlots(saved);
        }
        retainCareerSlots(initialWrestlers.map((saved) => saved.id));
        setCareers(toListItems(initialWrestlers));
      } else {
        setCareers(listCareers());
      }

      setError(loadError);
    } catch (caught) {
      console.error("Wrestler select:", caught);
      setCareers(toListItems(initialWrestlers));
      setError(
        loadError ??
          "Could not load career slots. You can still create a wrestler.",
      );
    }
  }, [clearCareerSelection, initialWrestlers, loadError]);

  async function handleSelect(careerId: string) {
    setError(null);
    try {
      const cloud = cloudById[careerId];
      const ok = cloud
        ? hydrateCareerFromSavedGame(cloud)
        : loadCareerIntoStore(careerId);
      if (!ok) {
        setError("Could not load that career. Try another wrestler.");
        setCareers(
          loadError ? listCareers() : toListItems(initialWrestlers),
        );
        return;
      }
      router.push("/dashboard");
    } catch (caught) {
      console.error("Select wrestler:", caught);
      setError("Could not load that career. Try another wrestler.");
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#172554_0%,_transparent_55%),linear-gradient(160deg,_#0c0e12_0%,_#12161f_45%,_#0c0e12_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 47px, #3b82f6 47px, #3b82f6 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, #3b82f6 47px, #3b82f6 48px)",
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
          <p className="mt-4 font-display text-lg font-semibold text-foreground">
            Wrestlers: {careers.length}
          </p>
          <Link
            href="/create"
            className="rwg-btn rwg-btn-primary mt-4 inline-flex w-full sm:w-auto"
          >
            Create New Wrestler
          </Link>
        </header>

        {error && (
          <p className="rwg-card-inset text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {careers.length === 0 ? (
          <section className="rwg-card text-center sm:text-left">
            <p className="rwg-label">Empty room</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
              No wrestlers yet
            </h2>
            <p className="mt-2 text-sm text-muted">
              Create your first athlete to start a career.
            </p>
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
      </main>
    </div>
  );
}
