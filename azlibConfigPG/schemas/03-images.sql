CREATE SCHEMA images;

--Create a type of acceptable images
CREATE TYPE image_type AS ENUM('photo','raster','pdf','other');

CREATE TABLE images.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);

--This is the master_table for the images schema that details the location of images and what they are associated with
CREATE TABLE images.images (
    image_id serial PRIMARY KEY,
    collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES images.metadata(metadata_id),
    path text NOT NULL
);

--Raster maps and images, I've decided to handle this separately from the intial configuration.
CREATE TABLE images.rasters (
	raster_id serial PRIMARY KEY,
	image_id integer REFERENCES images.images(image_id),
	rast raster
	);

--Create a gist index on the rasters
CREATE INDEX ON images.rasters USING GiST (ST_ConvexHull(rast));


