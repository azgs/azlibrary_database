update public.version set version=6;

create table if not exists public.roles (
	role_id serial PRIMARY KEY, 
	name text not null
);
insert into public.roles (name) values ('Admin');
insert into public.roles (name) values ('End User');

create table if not exists public.users (
	user_id serial PRIMARY KEY, 
	email text not null, 
	password text not null, 
	role_id integer references public.roles(role_id) not null default 2, --2 is End User
	first_name text, 
	last_name text, 
	organization text, 
	tos_accepted boolean not null default false,
	approved boolean not null default false,
	created_date timestamp,
	modified_date timestamp,
	pw_reset_token text,
	pw_reset_time bigint
);

drop table if exists initial_group_mapping;


