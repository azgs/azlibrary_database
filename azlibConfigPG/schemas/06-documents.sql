CREATE SCHEMA documents;

--Create a type of acceptable images
--CREATE TYPE doc_type AS ENUM('report','journal','chapter','book','guide','misc','abstract');

CREATE TABLE documents.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);

--This is the master_table for the documents schema that details the location of documents and what they are associated with
CREATE TABLE documents.documents (
	document_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES documents.metadata(metadata_id),
	--doc_type doc_type,
	path text NOT NULL,
	text_search tsvector
);
CREATE INDEX ts_idx ON documents.documents USING gin(text_search);

CREATE TABLE documents.types (
	type_name text PRIMARY KEY
);
insert into documents.types (type_name) values ('PDF');
insert into documents.types (type_name) values ('DOC');
insert into documents.types (type_name) values ('DOCX');
insert into documents.types (type_name) values ('TXT');
insert into documents.types (type_name) values ('RTF');
insert into documents.types (type_name) values ('HTM');
insert into documents.types (type_name) values ('HTML');

