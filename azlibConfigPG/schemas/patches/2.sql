create table public.version (
	version integer
);
insert into public.version (version) values (2);

alter table 
	public.uploads 
add column
	processing_notes jsonb;
