CREATE SCHEMA images;

--Create a type of acceptable images
CREATE TYPE image_type AS ENUM('photo','raster','pdf','other');

--This is the master_table for the images schema that details the location of images and what they are associated with
CREATE TABLE images.images (
        image_id serial PRIMARY KEY,
        collection_id integer REFERENCES public.collections(collection_id),
        image_type image_type,
        azgs_path text NOT NULL UNIQUE,
        caption text NOT NULL,
        restricted boolean NOT NULL, -- Copyrighted, redacted, etc.
        geom geometry
        );

--Raster maps and images, I've decided to handle this separately from the intial configuration.
CREATE TABLE images.rasters (
	raster_id serial PRIMARY KEY,
	image_id integer REFERENCES images.images(image_id),
	rast raster
	);

--Create a gist index on the rasters
CREATE INDEX ON images.rasters USING GiST (ST_ConvexHull(rast));


