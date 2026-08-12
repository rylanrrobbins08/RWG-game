"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  getGameSnapshot,
  type AttributeScores,
  useGameStore,
} from "@/lib/game-store";
import { persistGameNow } from "@/lib/game-sync";
import { commitNewCareerFromStore } from "@/lib/local-save";
import { canCreateCareer, replaceCareerId } from "@/lib/career-slots";
import { saveWrestler } from "@/lib/saveWrestler";
import { US_STATES } from "@/lib/wrestler-profile";
import AttributeLabel from "./AttributeLabel";

const weightClasses = [
  106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 195, 215, 285,
] as const;

/** Fixed starting value for every attribute — no bonus pool at creation. */
const ATTR_BASE = 10;

const startingAttributes = ATTRIBUTES.reduce(
  (acc, attr) => ({ ...acc, [attr]: ATTR_BASE }),
  {} as AttributeScores,
);

export default function WrestlerCreator() {
  const router = useRouter();
  const createWrestler = useGameStore((state) => state.createWrestler);
  const [name, setName] = useState("");
  const [hometown, setHometown] = useState("");
  const [stateCode, setStateCode] = useState("IA");
  const [weightClass, setWeightClass] =
    useState<(typeof weightClasses)[number]>(144);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canCreateCareer()) {
      setError("Career limit reached. Return to select and reuse a slot.");
      return;
    }

    createWrestler({
      name: name.trim(),
      weightClass,
      attributes: { ...startingAttributes },
      hometown: hometown.trim(),
      state: stateCode,
    });

    const careerId = commitNewCareerFromStore();
    if (!careerId) {
      setError("Could not save this career. Try again.");
      return;
    }

    setSaving(true);

    const result = await saveWrestler(getGameSnapshot());
    if (result.ok) {
      useGameStore.getState().setUserId(result.userId);
      if (result.id !== careerId) {
        replaceCareerId(careerId, result.id);
        useGameStore.getState().setActiveCareer(result.id, true);
      }
    } else if (result.error !== "Supabase is not configured.") {
      setSaving(false);
      setError(result.error);
      return;
    }

    await persistGameNow();
    setSaving(false);
    router.push("/dashboard");
    router.refresh();
  }

  const canCreate =
    name.trim().length > 0 &&
    hometown.trim().length > 0 &&
    stateCode.length === 2;

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

      <main className="relative mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <header className="text-center sm:text-left">
          <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
            Create Your Wrestler
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted sm:text-base">
            Name your athlete and pick a weight class. Every attribute starts at{" "}
            {ATTR_BASE} — grow them later through training and matches.
          </p>
        </header>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <label
              htmlFor="wrestler-name"
              className="font-display text-sm uppercase tracking-[0.14em] text-muted"
            >
              Name
            </label>
            <input
              id="wrestler-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter wrestler name"
              maxLength={40}
              className="rounded-md border border-panel-border bg-panel px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
              required
            />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="hometown"
                className="font-display text-sm uppercase tracking-[0.14em] text-muted"
              >
                Hometown
              </label>
              <input
                id="hometown"
                type="text"
                value={hometown}
                onChange={(e) => setHometown(e.target.value)}
                placeholder="City"
                maxLength={40}
                className="rounded-md border border-panel-border bg-panel px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="state"
                className="font-display text-sm uppercase tracking-[0.14em] text-muted"
              >
                State
              </label>
              <select
                id="state"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="rounded-md border border-panel-border bg-panel px-4 py-3 font-display text-base font-semibold text-foreground outline-none transition focus:border-accent"
                required
              >
                {US_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name} ({state.code})
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <label
                htmlFor="weight-class"
                className="font-display text-sm uppercase tracking-[0.14em] text-muted"
              >
                Weight Class
              </label>
              <span className="font-display text-lg font-semibold text-accent">
                {weightClass} lbs
              </span>
            </div>

            <div className="hidden grid-cols-4 gap-2 sm:grid sm:grid-cols-7">
              {weightClasses.map((wc) => {
                const selected = weightClass === wc;
                return (
                  <button
                    key={wc}
                    type="button"
                    onClick={() => setWeightClass(wc)}
                    aria-pressed={selected}
                    className={`rounded-md border px-2 py-2.5 font-display text-sm font-semibold tabular-nums transition ${
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-panel-border bg-panel text-foreground hover:border-accent/60"
                    }`}
                  >
                    {wc}
                  </button>
                );
              })}
            </div>

            <select
              id="weight-class"
              value={weightClass}
              onChange={(e) =>
                setWeightClass(Number(e.target.value) as (typeof weightClasses)[number])
              }
              className="rounded-md border border-panel-border bg-panel px-4 py-3 font-display text-base font-semibold text-foreground outline-none transition focus:border-accent sm:hidden"
            >
              {weightClasses.map((wc) => (
                <option key={wc} value={wc}>
                  {wc} lbs
                </option>
              ))}
            </select>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-sm uppercase tracking-[0.14em] text-muted">
                Starting Attributes
              </h2>
              <p className="font-display text-lg font-semibold tabular-nums text-accent">
                {ATTR_BASE}
                <span className="ml-1 text-sm font-medium text-muted">each</span>
              </p>
            </div>

            <div className="rounded-md border border-panel-border bg-panel/80 px-4 py-5">
              <p className="text-sm text-muted">
                All stats begin at {ATTR_BASE}. Point allocation is unlocked later in
                the Training Room — not during creation.
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {ATTRIBUTES.map((attr) => (
                  <li
                    key={attr}
                    className="flex items-center justify-between gap-2 text-sm"
                    title={ATTRIBUTE_INFO[attr]}
                  >
                    <AttributeLabel attr={attr} className="text-sm text-muted" />
                    <span className="font-display font-semibold tabular-nums text-foreground">
                      {ATTR_BASE}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <button
            type="submit"
            disabled={!canCreate || saving}
            className="rounded-md bg-accent px-6 py-3.5 font-display text-lg font-semibold uppercase tracking-[0.08em] text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Create Wrestler"}
          </button>
        </form>
      </main>
    </div>
  );
}
