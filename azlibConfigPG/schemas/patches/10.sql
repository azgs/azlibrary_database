update public.version set version=10;

alter table public.users add CONSTRAINT users_email_key UNIQUE (email);
