CREATE SCHEMA geodata;

CREATE TABLE geodata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);

CREATE TABLE geodata.legacy
(
	legacy_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
    metadata_id integer REFERENCES geodata.metadata(metadata_id),
	name text,
	path text,
	geom geometry
);

create table geodata.rasters
(
	raster_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES geodata.metadata(metadata_id),
	raster raster,
	srid integer, 
	tile_size text
	
);



