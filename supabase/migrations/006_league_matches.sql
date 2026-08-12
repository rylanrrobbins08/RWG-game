-- Shared PvP dual results so both players see the same bout outcome.

create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues (id) on delete cascade,
  event_id text not null,
  week integer not null default 1,
  member_a text not null,
  member_b text not null,
  winner_key text,
  score_a integer,
  score_b integer,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint league_matches_pair unique (league_id, event_id, member_a, member_b)
);

create index if not exists league_matches_league_event_idx
  on public.league_matches (league_id, event_id);

alter table public.league_matches enable row level security;

create policy "Authenticated users can read league matches"
  on public.league_matches for select to authenticated
  using (true);

create policy "Authenticated users can insert league matches"
  on public.league_matches for insert to authenticated
  with check (true);

create policy "Authenticated users can update league matches"
  on public.league_matches for update to authenticated
  using (true)
  with check (true);
