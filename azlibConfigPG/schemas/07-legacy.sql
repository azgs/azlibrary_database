CREATE SCHEMA legacy;

CREATE TABLE legacy.geodata
(
	geodata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	name text,
	path text,
	geom geometry
);

CREATE TABLE legacy.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);
