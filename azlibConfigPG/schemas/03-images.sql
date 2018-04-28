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



