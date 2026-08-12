-- Shared online leagues: metadata, membership, and per-weight-class standings.

create table if not exists public.leagues (
  id text primary key,
  name text not null,
  code text not null,
  created_by uuid references auth.users (id) on delete set null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  constraint leagues_code_key unique (code)
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id text not null references public.leagues (id) on delete cascade,
  member_key text not null,
  user_id uuid references auth.users (id) on delete cascade,
  wrestler_name text not null,
  school text not null default '',
  weight_class integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  is_bot boolean not null default false,
  tier text,
  updated_at timestamptz not null default now(),
  constraint league_members_league_key unique (league_id, member_key)
);

create index if not exists leagues_code_idx on public.leagues (code);
create index if not exists league_members_league_weight_idx
  on public.league_members (league_id, weight_class);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create policy "Authenticated users can read leagues"
  on public.leagues for select to authenticated
  using (true);

create policy "Authenticated users can create leagues"
  on public.leagues for insert to authenticated
  with check (created_by = auth.uid());

create policy "Authenticated users can read members"
  on public.league_members for select to authenticated
  using (true);

create policy "Users can insert membership or bots"
  on public.league_members for insert to authenticated
  with check (
    (is_bot = true)
    or (user_id = auth.uid())
  );

create policy "Users can update league standings"
  on public.league_members for update to authenticated
  using (true)
  with check (true);

-- Seed the preset open circuits so everyone can browse/join the same rooms.
insert into public.leagues (id, name, code, created_by, is_open)
values
  ('midwest-circuit', 'Midwest Circuit', 'MWST', null, true),
  ('coastal-clash', 'Coastal Clash', 'COAST', null, true),
  ('iron-belt', 'Iron Belt Duals', 'IRON', null, true),
  ('heartland-open', 'Heartland Open', 'HLAND', null, true)
on conflict (id) do nothing;
