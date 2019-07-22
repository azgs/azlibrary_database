CREATE SCHEMA gisdata;

CREATE TABLE gisdata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	metadata_file text not null
);
CREATE INDEX metadata_id_idx ON gisdata.metadata (metadata_id);
CREATE INDEX metadata_collection_id_idx ON gisdata.metadata (collection_id);

CREATE TABLE gisdata.legacy (
    legacy_id serial PRIMARY KEY,
    collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES gisdata.metadata(metadata_id),
    path text NOT NULL
);
CREATE INDEX legacy_id_idx ON gisdata.legacy (legacy_id);
CREATE INDEX legacy_collection_id_idx ON gisdata.legacy (collection_id);

CREATE TABLE gisdata.layers
(
	layer_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
    metadata_id integer REFERENCES gisdata.metadata(metadata_id),
	name text,
	path text,
	geom geometry,
	bbox_from_meta boolean
);
CREATE INDEX layers_id_idx ON gisdata.layers (layer_id);
CREATE INDEX layers_collection_id_idx ON gisdata.layers (collection_id);

create table gisdata.rasters
(
	raster_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES gisdata.metadata(metadata_id),
	raster raster,
	srid integer, 
	tile_size text
	
);
CREATE INDEX rasters_id_idx ON gisdata.rasters (raster_id);
CREATE INDEX rasters_collection_id_idx ON gisdata.rasters (collection_id);

CREATE TABLE gisdata.raster_types (
	type_name text PRIMARY KEY
);
insert into gisdata.raster_types (type_name) values ('TIF');
insert into gisdata.raster_types (type_name) values ('TIFF');




