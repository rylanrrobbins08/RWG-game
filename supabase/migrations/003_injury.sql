-- Optional injury status for wrestler careers.

alter table public.wrestlers
  add column if not exists injury jsonb;
