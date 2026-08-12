-- Optional weight-cut fields for wrestler careers.

alter table public.wrestlers
  add column if not exists natural_weight integer;

alter table public.wrestlers
  add column if not exists weight_cut text not null default 'none';

update public.wrestlers
set natural_weight = weight_class + 5
where natural_weight is null;
