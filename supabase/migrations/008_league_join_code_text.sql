-- Join codes stay in text columns. League ids stay UUIDs.

alter table public.leagues
  alter column code type text using code::text;

alter table public.leagues
  add column if not exists join_code text;

update public.leagues
set join_code = code
where join_code is null
  and code is not null
  and char_length(code) <= 8
  and code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create unique index if not exists leagues_join_code_key
  on public.leagues (join_code)
  where join_code is not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leagues'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.leagues
      alter column id set default gen_random_uuid();
  end if;
end $$;
