CREATE SCHEMA metadata;

create table metadata.types
(
	type_name text primary key
);
insert into metadata.types (type_name) values ('FGDC');
insert into metadata.types (type_name) values ('ISO19139');

CREATE TABLE metadata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);


/*
CREATE TABLE metadata.json_entries
(
	json_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	type text references metadata.types(type_name),
	metadata jsonb,
	metadata_file text
);

CREATE TABLE metadata.xml_entries
(
	xml_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	type text references metadata.types(type_name) not null,
	textdata text,
	--xmldata text, This does not behave as expected. Might revisit later.
	metadata_file text
);
*/
