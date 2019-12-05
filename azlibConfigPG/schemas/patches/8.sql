update public.version set version=8;

alter table 
	public.uploads 
add column 
	user_id integer references public.users(user_id);

create type actions as enum ('CREATE', 'REPLACE', 'PATCH', 'DELETE');
alter table 
	public.uploads 
add column 
	action actions;
