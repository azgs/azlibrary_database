CREATE SCHEMA documents;

--Create a type of acceptable images
--CREATE TYPE doc_type AS ENUM('report','journal','chapter','book','guide','misc','abstract');

CREATE TABLE documents.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	metadata_file text not null
);
CREATE INDEX metadata_id_idx ON documents.metadata (metadata_id);
CREATE INDEX metadata_collection_id_idx ON documents.metadata (collection_id);

--This is the master_table for the documents schema that details the location of documents and what they are associated with
CREATE TABLE documents.documents (
	document_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
    metadata_id integer REFERENCES documents.metadata(metadata_id),
	--doc_type doc_type,
	path text NOT NULL,
	text_search tsvector
);
CREATE INDEX documents_id_idx ON documents.documents (document_id);
CREATE INDEX documents_collection_id_idx ON documents.documents (collection_id);
CREATE INDEX documents_ts_idx ON documents.documents USING gin(text_search);

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
insert into documents.types (type_name) values ('LOG'); --TODO: for testing only!

