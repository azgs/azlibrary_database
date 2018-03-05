CREATE SCHEMA legacy;

CREATE TABLE legacy.geodata
(
	geodata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	name text,
	path text,
	geom geometry
);

