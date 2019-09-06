update public.version set version=5;

alter table
	public.collections
alter column 
	archive_id
set data type oid;
