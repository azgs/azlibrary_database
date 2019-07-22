CREATE SCHEMA images;

--Create a type of acceptable images
CREATE TYPE image_type AS ENUM('photo','raster','pdf','other');

CREATE TABLE images.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	metadata_file text not null
);
CREATE INDEX metadata_id_idx ON images.metadata (metadata_id);
CREATE INDEX metadata_collection_id_idx ON images.metadata (collection_id);

--This is the master_table for the images schema that details the location of images and what they are associated with
CREATE TABLE images.images (
    image_id serial PRIMARY KEY,
    collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES images.metadata(metadata_id),
    path text NOT NULL
);
CREATE INDEX images_id_idx ON images.images (image_id);
CREATE INDEX images_collection_id_idx ON images.images (collection_id);




