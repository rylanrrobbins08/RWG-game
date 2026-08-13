-- Join codes are short shareable text (ABC123).
-- League id and created_by must be real UUIDs.

-- If `code` was created as uuid, this makes it text so "ABC123" is valid.
alter table public.leagues
  alter column code type text using code::text;

-- created_by stays uuid (auth.users).
-- Convert text slug ids (friday-night-room-1234) to uuid when needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leagues'
      and column_name = 'id'
      and data_type = 'text'
  ) then
    alter table public.league_members drop constraint if exists league_members_league_id_fkey;
    alter table public.league_matches drop constraint if exists league_matches_league_id_fkey;

    alter table public.leagues add column if not exists id_uuid uuid;
    update public.leagues
    set id_uuid = case
      when id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then id::uuid
      else gen_random_uuid()
    end
    where id_uuid is null;

    alter table public.league_members add column if not exists league_id_uuid uuid;
    update public.league_members as members
    set league_id_uuid = leagues.id_uuid
    from public.leagues
    where members.league_id = leagues.id;

    alter table public.league_matches add column if not exists league_id_uuid uuid;
    update public.league_matches as matches
    set league_id_uuid = leagues.id_uuid
    from public.leagues
    where matches.league_id = leagues.id;

    alter table public.leagues drop constraint if exists leagues_pkey;
    alter table public.leagues drop column id;
    alter table public.leagues rename column id_uuid to id;
    alter table public.leagues alter column id set not null;
    alter table public.leagues add primary key (id);

    alter table public.league_members drop column league_id;
    alter table public.league_members rename column league_id_uuid to league_id;
    alter table public.league_members alter column league_id set not null;
    alter table public.league_members
      add constraint league_members_league_id_fkey
      foreign key (league_id) references public.leagues (id) on delete cascade;

    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'league_matches'
    ) then
      alter table public.league_matches drop column league_id;
      alter table public.league_matches rename column league_id_uuid to league_id;
      alter table public.league_matches alter column league_id set not null;
      alter table public.league_matches
        add constraint league_matches_league_id_fkey
        foreign key (league_id) references public.leagues (id) on delete cascade;
    end if;
  end if;
end $$;
