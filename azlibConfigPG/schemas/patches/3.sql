update public.version set version=3;

alter table public.collections drop column deprecated;
