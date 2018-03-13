CREATE SCHEMA documents;

--Create a type of acceptable images
CREATE TYPE doc_type AS ENUM('report','journal','chapter','book','guide','misc','abstract');

--This is the master_table for the documents schema that details the location of documents and what they are associated with
CREATE TABLE documents.documents (
	document_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
	doc_type doc_type,
	azgs_path text NOT NULL UNIQUE,
	doc_doi text,
	text_search tsvector,
	restricted boolean NOT NULL, -- Copyrighted, redacted, etc.
	geom geometry
);
CREATE INDEX ts_idx ON documents.documents USING gin(text_search);

CREATE TABLE documents.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);
