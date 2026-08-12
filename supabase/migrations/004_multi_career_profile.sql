-- Multiple wrestler careers per user, plus profile fields and a full save blob.

alter table public.wrestlers
  drop constraint if exists wrestlers_user_id_key;

alter table public.wrestlers
  add column if not exists grade text;

alter table public.wrestlers
  add column if not exists study_progress integer;

alter table public.wrestlers
  add column if not exists hometown text;

alter table public.wrestlers
  add column if not exists state text;

alter table public.wrestlers
  add column if not exists national_rank integer;

alter table public.wrestlers
  add column if not exists state_rank integer;

alter table public.wrestlers
  add column if not exists save jsonb;
