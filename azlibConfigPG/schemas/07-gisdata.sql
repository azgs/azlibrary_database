CREATE SCHEMA gisdata;

CREATE TABLE gisdata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);

CREATE TABLE gisdata.legacy
(
	legacy_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
    metadata_id integer REFERENCES gisdata.metadata(metadata_id),
	name text,
	path text,
	geom geometry
);

create table gisdata.rasters
(
	raster_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES gisdata.metadata(metadata_id),
	raster raster,
	srid integer, 
	tile_size text
	
);

CREATE TABLE gisdata.raster_types (
	type_name text PRIMARY KEY
);
insert into gisdata.raster_types (type_name) values ('TIF');
insert into gisdata.raster_types (type_name) values ('TIFF');




