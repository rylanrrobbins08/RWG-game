-- RWG wrestler saves (one active career per user for now).
-- Run in the Supabase SQL editor or via the CLI.

create extension if not exists "pgcrypto";

create table if not exists public.wrestlers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  weight_class integer not null,
  attributes jsonb not null,
  record jsonb not null default '{"wins": 0, "losses": 0}'::jsonb,
  energy integer not null default 100,
  fatigue integer not null default 0,
  budget integer not null default 2000,
  week integer not null default 1,
  season integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrestlers_user_id_key unique (user_id)
);

create index if not exists wrestlers_user_id_idx on public.wrestlers (user_id);

alter table public.wrestlers enable row level security;

create policy "Users can select own wrestlers"
  on public.wrestlers
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own wrestlers"
  on public.wrestlers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own wrestlers"
  on public.wrestlers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own wrestlers"
  on public.wrestlers
  for delete
  to authenticated
  using (auth.uid() = user_id);
