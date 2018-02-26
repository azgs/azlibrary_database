--Create the projects table. This table is for defining the overarching funding/project that a set of data collections were collected under - e.g, StateMap 2017, NGGDP 2018. All collections must be associated with a project. For older collections belonging to an unknown project, use "unknown legacy project"
CREATE TABLE projects (
	project_id serial PRIMARY KEY,
	project_name text NOT NULL,
	project_desc text NOT NULL
);

--Create the publications table. This table is for defining the publication associated with a set of data. Not all data will have been published - e.g., journal, book, field guide.
CREATE TABLE publications (
	publication_id serial PRIMARY KEY,
	publication_name text NOT NULL,
	publication_outlet text[] NOT NULL,
	publication_volume integer,
	publication_issue integer,
	first_author text NOT NULL,
	all_authors text[] NOT NULL,
	year smallint NOT NULL,
	bibjson json, --json of publication metadata
	mapjson json --json of map metadata
);

--This is the collections, its purpose to to keep track of what collections have been entered and their relations
CREATE TABLE collections (
	collection_id serial PRIMARY KEY, 
	project_id integer NOT NULL REFERENCES projects(project_id),
	publication_id integer UNIQUE REFERENCES publications(publication_id), -- Unique because collection_id is synonymous with publication_id, but not all collections may have publication_id
	formal_name text UNIQUE,
	informal_name text,
	azgs_path text NOT NULL UNIQUE,
	azlib_path text,
	usgs_path text,
	doi text
);

--Add a comment describing the date and time that the database was created
--COMMENT ON TABLE collections IS 'Date: ' || to_char(current_timestamp, 'MM-DD-YYYY HH24:MI:SS TZ');
--Have to do this to accomplish the above, sheesh:
DO
$do$
BEGIN
EXECUTE format($$COMMENT ON TABLE collections IS 'Table create date: %s'$$, current_timestamp);
END
$do$;

--This is the upload_log table, its purpose is to help keep track of what uploads have been attempted and whether they were successful, and whether they were removed if unsuccessfull
CREATE TABLE uploads (
	upload_id serial PRIMARY KEY,
	collection_id integer NOT NULL REFERENCES collections(collection_id),
	created_at timestamptz NOT NULL,
	completed_at timestamptz,
	removed boolean NOT NULL default FALSE
);


