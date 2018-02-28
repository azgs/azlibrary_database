CREATE SCHEMA metadata;

CREATE TABLE metadata.json_entries
(
	json_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	metadata jsonb,
	metadata_file text
);

CREATE TABLE metadata.xml_entries
(
	xml_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	textdata text,
	xmldata xml,
	metadata_file text
);

