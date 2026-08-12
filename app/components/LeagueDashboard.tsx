"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getEffectiveAttributes,
  OPEN_LEAGUES,
  STANDINGS_DISPLAY_COUNT,
  WEIGHT_CLASS_BOT_COUNT,
  topLeagueStandings,
  useGameStore,
} from "@/lib/game-store";
import type { LeagueWrestler, PlayerLeague, WrestlerScoutProfile } from "@/lib/league";
import { normalizeLeagueMember } from "@/lib/league";
import {
  createLeagueOnline,
  joinLeagueOnline,
  listOpenLeagues,
  loadLeagueRosterOnline,
} from "@/lib/league-actions";
import { persistGameNow } from "@/lib/game-sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import ArenaPage from "./ArenaPage";
import WrestlerAvatar from "./WrestlerAvatar";
import WrestlerScoutModal from "./WrestlerScoutModal";

type ChatMessage = {
  id: string;
  user: string;
  text: string;
  time: string;
  you?: boolean;
};

type LeagueModal = "join" | "create" | null;

type OnlineLeagueSuccess = {
  ok: true;
  league: PlayerLeague;
  roster: LeagueWrestler[];
};

function hasOnlineRoster(
  result: { ok: true; league: PlayerLeague; roster?: unknown },
): result is OnlineLeagueSuccess {
  return Array.isArray(result.roster);
}

const INITIAL_CHAT: ChatMessage[] = [
  { id: "c1", user: "CoachM", text: "Big dual night — stay sharp on top.", time: "7:42 PM" },
  { id: "c2", user: "Hale145", text: "Room is stacked this week.", time: "7:45 PM" },
  { id: "c3", user: "Ortiz", text: "Who's wrestling first?", time: "7:51 PM" },
  { id: "c4", user: "System", text: "Standings update live after every bout.", time: "7:54 PM" },
  { id: "c5", user: "Brooks", text: "Anyone cutting for Saturday?", time: "8:01 PM" },
];

export default function LeagueDashboard() {
  const wrestler = useGameStore((state) => state.wrestler);
  const leagueRoster = useGameStore((state) => state.leagueRoster);
  const playerLeagues = useGameStore((state) => state.playerLeagues);
  const activeLeagueId = useGameStore((state) => state.activeLeagueId);
  const ensureWeightClassRoster = useGameStore(
    (state) => state.ensureWeightClassRoster,
  );
  const createPlayerLeague = useGameStore((state) => state.createPlayerLeague);
  const joinLeague = useGameStore((state) => state.joinLeague);
  const setActiveLeague = useGameStore((state) => state.setActiveLeague);
  const applyOnlineLeague = useGameStore((state) => state.applyOnlineLeague);

  const activeLeague =
    playerLeagues.find((league) => league.id === activeLeagueId) ??
    playerLeagues[0] ??
    OPEN_LEAGUES[0];

  const [messages, setMessages] = useState(INITIAL_CHAT);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(
    `You're in ${activeLeague.name}. Tap a wrestler to scout attributes.`,
  );
  const [scout, setScout] = useState<WrestlerScoutProfile | null>(null);
  const [modal, setModal] = useState<LeagueModal>(null);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openLeagues, setOpenLeagues] = useState<PlayerLeague[]>(OPEN_LEAGUES);

  useEffect(() => {
    ensureWeightClassRoster();
  }, [ensureWeightClassRoster, wrestler.weightClass, activeLeagueId]);

  useEffect(() => {
    setStatus(
      `You're in ${activeLeague.name} · code ${activeLeague.code}. Tap a wrestler to scout attributes.`,
    );
  }, [activeLeague.name, activeLeague.code]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void listOpenLeagues().then((result) => {
      if (result.ok && result.leagues.length > 0) {
        setOpenLeagues(result.leagues);
      }
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    async function refreshRoster() {
      const result = await loadLeagueRosterOnline(
        activeLeagueId,
        wrestler.weightClass,
      );
      if (cancelled || !result.ok) return;
      applyOnlineLeague(result.league, result.roster);
    }

    void refreshRoster();
    const timer = window.setInterval(() => {
      void refreshRoster();
    }, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeLeagueId, applyOnlineLeague, wrestler.weightClass]);

  const playerAttrs = useMemo(
    () => getEffectiveAttributes(wrestler),
    [wrestler],
  );

  const standings = useMemo(() => {
    const synced = leagueRoster.map((member) => {
      const normalized = normalizeLeagueMember(member);
      if (!normalized.isPlayer) return normalized;
      return {
        ...normalized,
        name: wrestler.name,
        wins: wrestler.record.wins,
        losses: wrestler.record.losses,
        attributes: playerAttrs,
      };
    });
    return topLeagueStandings(synced, STANDINGS_DISPLAY_COUNT);
  }, [
    leagueRoster,
    wrestler.name,
    wrestler.record.wins,
    wrestler.record.losses,
    playerAttrs,
  ]);

  const fieldSize = leagueRoster.length;

  const openToJoin = useMemo(() => {
    const joined = new Set(playerLeagues.map((league) => league.id));
    return openLeagues.filter((league) => !joined.has(league.id));
  }, [openLeagues, playerLeagues]);

  function openScout(profile: WrestlerScoutProfile) {
    setScout(profile);
  }

  function openModal(next: LeagueModal) {
    setFormError(null);
    setCreateName("");
    setJoinCode("");
    setModal(next);
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        user: wrestler.name,
        text,
        time: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        you: true,
      },
    ]);
    setDraft("");
  }

  function playerSnapshot() {
    return {
      name: wrestler.name,
      weightClass: wrestler.weightClass,
      wins: wrestler.record.wins,
      losses: wrestler.record.losses,
      attributes: wrestler.attributes,
    };
  }

  async function handleCreateLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const online = isSupabaseConfigured
      ? await createLeagueOnline(createName, playerSnapshot())
      : createPlayerLeague(createName);
    setBusy(false);
    if (!online.ok) {
      setFormError(online.error);
      return;
    }
    if (hasOnlineRoster(online)) {
      applyOnlineLeague(online.league, online.roster);
    }
    persistGameNow();
    setStatus(
      `Created ${online.league.name}. Share code ${online.league.code} to invite others.`,
    );
    setModal(null);
  }

  async function handleJoinByCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const online = isSupabaseConfigured
      ? await joinLeagueOnline({ code: joinCode }, playerSnapshot())
      : joinLeague({ code: joinCode });
    setBusy(false);
    if (!online.ok) {
      setFormError(online.error);
      return;
    }
    if (hasOnlineRoster(online)) {
      applyOnlineLeague(online.league, online.roster);
    }
    persistGameNow();
    setStatus(`Joined ${online.league.name}. Standings refreshed.`);
    setModal(null);
  }

  async function handleJoinOpen(leagueId: string) {
    setBusy(true);
    const online = isSupabaseConfigured
      ? await joinLeagueOnline({ leagueId }, playerSnapshot())
      : joinLeague({ leagueId });
    setBusy(false);
    if (!online.ok) {
      setFormError(online.error);
      return;
    }
    if (hasOnlineRoster(online)) {
      applyOnlineLeague(online.league, online.roster);
    }
    persistGameNow();
    setStatus(`Joined ${online.league.name}. Standings refreshed.`);
    setModal(null);
  }

  async function handleSwitchLeague(leagueId: string) {
    if (isSupabaseConfigured) {
      setBusy(true);
      const online = await loadLeagueRosterOnline(
        leagueId,
        wrestler.weightClass,
      );
      setBusy(false);
      if (online.ok) {
        applyOnlineLeague(online.league, online.roster);
        persistGameNow();
        setStatus(`Switched to ${online.league.name}. Standings updated.`);
        return;
      }
    }
    const result = setActiveLeague(leagueId);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus(`Switched to ${result.league.name}. Standings updated.`);
  }

  return (
    <ArenaPage>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <WrestlerAvatar name={wrestler.name} size="md" />
          <div>
            <p className="rwg-label">League</p>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-foreground sm:text-4xl">
              {activeLeague.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Code {activeLeague.code} · {wrestler.weightClass} lbs ·{" "}
              {WEIGHT_CLASS_BOT_COUNT} bots + you · showing top{" "}
              {STANDINGS_DISPLAY_COUNT} · Your record {wrestler.record.wins}-
              {wrestler.record.losses}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openModal("join")}
            className="rwg-btn rwg-btn-ghost"
          >
            Join League
          </button>
          <button
            type="button"
            onClick={() => openModal("create")}
            className="rwg-btn rwg-btn-primary"
          >
            Create League
          </button>
        </div>
      </header>

      <p className="rwg-card-inset text-sm text-muted" role="status">
        {status}
      </p>

      {playerLeagues.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {playerLeagues.map((league) => {
            const active = league.id === activeLeagueId;
            return (
              <button
                key={league.id}
                type="button"
                onClick={() => handleSwitchLeague(league.id)}
                className={`rounded-md border px-3 py-1.5 text-xs uppercase tracking-[0.1em] transition ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-panel-border bg-panel/60 text-muted hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {league.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rwg-card">
          <p className="rwg-label">Leaderboard</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Season Standings
          </h2>
          <p className="mt-1 text-sm text-muted">
            Top {STANDINGS_DISPLAY_COUNT} of {fieldSize} in the{" "}
            {wrestler.weightClass} lbs class — tap a name to scout.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-panel-border text-xs uppercase tracking-[0.12em] text-muted">
                  <th className="pb-2 pr-3 font-medium">Rank</th>
                  <th className="pb-2 pr-3 font-medium">Wrestler</th>
                  <th className="pb-2 pr-3 font-medium">School</th>
                  <th className="pb-2 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-panel-border/60 last:border-0 ${
                      row.isPlayer ? "bg-accent/10" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-display font-semibold tabular-nums text-accent">
                      {row.rank}
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() =>
                          openScout({
                            id: row.id,
                            name: row.name,
                            school: row.school,
                            wins: row.wins,
                            losses: row.losses,
                            attributes: row.attributes,
                            isPlayer: row.isPlayer,
                            weightClass: row.weightClass,
                          })
                        }
                        className="text-left font-medium text-foreground underline decoration-accent/40 underline-offset-2 transition hover:text-accent hover:decoration-accent"
                      >
                        {row.name}
                        {row.isPlayer && (
                          <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-accent no-underline">
                            You
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{row.school}</td>
                    <td className="py-2.5 font-display font-semibold tabular-nums text-foreground">
                      {row.wins}-{row.losses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rwg-card flex min-h-[22rem] flex-col">
          <p className="rwg-label">League Chat</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Room Talk
          </h2>

          <ul className="mt-4 mb-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-md border border-panel-border bg-background/40 p-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-md px-3 py-2 ${
                  message.you ? "bg-accent/15" : "bg-panel/80"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-display text-xs uppercase tracking-[0.1em] ${
                      message.you ? "text-accent" : "text-muted"
                    }`}
                  >
                    {message.user}
                  </span>
                  <span className="text-[11px] text-muted">{message.time}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{message.text}</p>
              </li>
            ))}
          </ul>

          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Say something to the league..."
              maxLength={160}
              className="min-w-0 flex-1 rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/60 focus:border-accent"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rwg-btn rwg-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {scout && (
        <WrestlerScoutModal profile={scout} onClose={() => setScout(null)} />
      )}

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="league-modal-title"
          onClick={() => setModal(null)}
        >
          <div
            className="rwg-card w-full max-w-md shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="rwg-label">
                  {modal === "create" ? "New circuit" : "Open circuits"}
                </p>
                <h2
                  id="league-modal-title"
                  className="mt-1 font-display text-xl font-semibold text-foreground"
                >
                  {modal === "create" ? "Create League" : "Join League"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rwg-btn rwg-btn-ghost text-xs"
              >
                Close
              </button>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-400" role="alert">
                {formError}
              </p>
            )}

            {modal === "create" ? (
              <form onSubmit={handleCreateLeague} className="mt-4 space-y-3">
                <label className="block text-sm text-muted">
                  League name
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Friday Night Room"
                    maxLength={40}
                    autoFocus
                    className="mt-1.5 w-full rounded-md border border-panel-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/60 focus:border-accent"
                  />
                </label>
                <p className="text-xs text-muted">
                  Creates a fresh standings field for your weight class and
                  generates a join code.
                </p>
                <button
                  type="submit"
                  disabled={busy || createName.trim().length < 3}
                  className="rwg-btn rwg-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Create & enter"}
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-5">
                {openToJoin.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">
                      Browse open
                    </p>
                    <ul className="mt-2 space-y-2">
                      {openToJoin.map((league) => (
                        <li key={league.id}>
                          <button
                            type="button"
                            onClick={() => handleJoinOpen(league.id)}
                            disabled={busy}
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-panel-border bg-background/40 px-3 py-2.5 text-left transition hover:border-accent/60"
                          >
                            <span>
                              <span className="block font-medium text-foreground">
                                {league.name}
                              </span>
                              <span className="text-xs text-muted">
                                Code {league.code}
                              </span>
                            </span>
                            <span className="text-xs uppercase tracking-[0.1em] text-accent">
                              Join
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <form onSubmit={handleJoinByCode} className="space-y-3">
                  <label className="block text-sm text-muted">
                    Or enter a code
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="MWST"
                      maxLength={8}
                      className="mt-1.5 w-full rounded-md border border-panel-border bg-background/60 px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-foreground outline-none placeholder:text-muted/60 focus:border-accent"
                    />
                  </label>
                  <p className="text-xs text-muted">
                    Use a code from another player, or join a listed circuit.
                  </p>
                  <button
                    type="submit"
                    disabled={busy || !joinCode.trim()}
                    className="rwg-btn rwg-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? "Joining…" : "Join with code"}
                  </button>
                </form>

                {playerLeagues.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">
                      Your leagues
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {playerLeagues.map((league) => (
                        <li
                          key={league.id}
                          className="flex items-center justify-between gap-2 text-sm text-muted"
                        >
                          <span className="text-foreground">{league.name}</span>
                          <span className="font-mono text-xs tracking-wider">
                            {league.code}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </ArenaPage>
  );
}
