create table public.version (
	version integer
);
insert into public.version (version) values (12);

-- User management
create table if not exists public.roles (
	role_id serial PRIMARY KEY, 
	name text not null
);
insert into public.roles (name) values ('Admin');
insert into public.roles (name) values ('End User');

create table if not exists public.users (
	user_id serial PRIMARY KEY, 
	email text unique not null, 
	password text not null, 
	role_id integer references public.roles(role_id) not null default 2, --2 is End User
	first_name text, 
	last_name text, 
	organization text, 
	tos_accepted boolean not null default false,
	approved boolean not null default false,
	created_date timestamp,
	modified_date timestamp,
	pw_reset_token text,
	pw_reset_time bigint
);

--Create the collection_groups table. This table is for defining the overarching funding/project that a set of data collections were collected under - e.g, StateMap 2017, NGGDP 2018. All collections must be associated with a collection_group. For older collections belonging to an unknown project, use "unknown legacy project"
CREATE TABLE collection_groups (
	collection_group_id serial PRIMARY KEY,
	collection_group_name text UNIQUE NOT NULL,
	collection_group_desc text,
	collection_group_abbrv text
);
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Airphoto indexes', NULL, 'APIX');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Open File Reports', 'Since 1973, our most prolific publication series used to fast-track release of field investigations.  ', 'AOFR');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('US Bureau of Mines (I.C.)', 'Select Arizona-based USBM-Investigation Circular documents.', 'BMIC');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Digital Information', 'Spatial data in Arc/INFO, ArcView, or ArcGIS data format.  ', 'AGDI');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Troy L. Péwé Environmental Geology Collection', 'Thematic environmental geology investigations of geologic hazards, landform, and groundwater maps for Phoenix, Arizona and environs.', 'PEGC');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geology - Fieldnotes Newsletters', 'Newsletter(s) of the Arizona Geological Survey - 1971 to the Present. Written for a general audience. ', 'AGFN');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Contributed Reports', 'Geologic reports drafted by non-AZGS geologists since January 1989. ', 'AGCR');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Contributed Maps', 'Geologic maps produced by geologists not affiliated with AZGS.  ', 'AGCM');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey - Miscellaneous Maps', 'Geologic maps produced by geologists not affiliated with AZGS; replaced by Contributed Maps series in January 1989.', 'AGMM');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Special Paper', 'Geologic reports or maps frequently produced by non-AZGS geologists. ', 'AGSP');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Poster Publications', 'Technical posters produced by AZGS Staff and presented at conferences and workshops.', 'PPPP');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Oil & Gas Publications', 'A broad variety of reports and maps related to oil and gas resources in Arizona.  ', 'OGPB');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Down-To-Earth Series', 'AZGS award-winning non-technical geology booklet series; 22 volumes .', 'DTES');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Map Series', 'Geologic maps of Arizona published at variable scales. ', 'AGMS');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Mine Files', 'Miscellaneous files of select Arizona mines from the files of the former Arizona Dept. of Mines and Mineral Resources. ', 'AZMR');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Circulars', 'Comprises formal geologic maps and reports including bibliographies for metallic mineral districts for select Arizona counties.', 'AGSC');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('US Bureau of Mines (R.I)', 'Select Arizona-based Research Investigation reports of the US Bureau of Mines', 'BMRI');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Geologic Investiation Folio', ' Environmental Geology of the McDowell Mountains Area, Maricopa County, Arizona.', 'GGIF');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Special Paper 9', 'A compendium of presentations of the 48th Forum on the Geology of Industrial Minerals was held in Scottsdale, Arizona, April 30 - May 4, 2012.', 'AGS9');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Bulletins', 'Formal geologic maps and reports; 200 volumes.', 'AGSB');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Department of Mines and Mineral Resources', 'Digital publications and miscellaneous literature published by the Arizona Department of Mines and Mineral Resources.', 'ADMM');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Digital Geologic Maps', 'Geologic maps typically at 1:24,000 scale and frequently accompanied by text reports. ', 'ADGM');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geological Survey Digital Maps (DM)', 'Thematic environmental geology maps and reports: - earth fissures, debris flows, and Holocene river maps', 'AGDM');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Arizona Geology Magazine', 'A publication of the Arizona Geological Survey (AZGS)', 'GMAG');



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

CREATE TABLE lineage (
	lineage_id serial PRIMARY KEY,
	collection text REFERENCES collections(perm_id), 
	supersedes text references collections(perm_id),
	UNIQUE (collection, supersedes)
);

--This is the collections, its purpose to to keep track of what collections have been entered and their relations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE collections (
	collection_id serial PRIMARY KEY, 
	perm_id text not null unique, -- default uuid_generate_v1(),
	private boolean not null default false,
	collection_group_id integer REFERENCES collection_groups(collection_group_id),
	publication_id integer UNIQUE REFERENCES publications(publication_id), -- Unique because collection_id is synonymous with publication_id, but not all collections may have publication_id
	formal_name text,
	informal_name text,
	azgs_old_url text,-- UNIQUE,
	ua_library text,
	usgs_path text,
	doi text,
	archive_id oid,
	removed boolean not null default true
);

create index collections_id_index on public.collections (collection_id);
create index collections_perm_id_index on public.collections (perm_id);

--Add a comment describing the date and time that the database was created
--COMMENT ON TABLE collections IS 'Date: ' || to_char(current_timestamp, 'MM-DD-YYYY HH24:MI:SS TZ');
--Have to do this to accomplish the above, sheesh:
DO
$do$
BEGIN
EXECUTE format($$COMMENT ON TABLE collections IS 'Table create date: %s'$$, current_timestamp);
END
$do$;

create or replace function make_perm_id() returns trigger as $$
declare
	cg text;
begin
    if NEW.perm_id is null then
    	SELECT collection_group_abbrv into cg FROM public.collection_groups where collection_group_id = NEW.collection_group_id;
   		NEW.perm_id :=  concat(cg, '-', floor(extract(epoch from now()) * 1000)::text, '-', floor(random() * 1000 + 1)::text);
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trig_make_perm_id
	before insert
	on collections
	for each row
		execute procedure make_perm_id();

-- View to facilitate working with the lineage table
create view
	public.collections_lineage_view
as
	select 
		c.*,
		jsonb_agg(l1.collection) as superseded_by,
		jsonb_agg (l2.supersedes) as supersedes
	from 
		public.collections c
		left join public.lineage l1 on l1.supersedes = c.perm_id
		left join public.lineage l2 on l2.collection = c.perm_id
	group by c.collection_id;


--This is the upload_log table, its purpose is to help keep track of what uploads have been attempted and whether they were successful, and whether they were removed if unsuccessfull
create type actions as enum ('CREATE', 'REPLACE', 'PATCH', 'DELETE');
CREATE TABLE uploads (
	upload_id serial PRIMARY KEY,
	collection_id integer REFERENCES collections(collection_id),
	created_at timestamptz NOT NULL,
	completed_at timestamptz,
	failed_at timestamptz,
	source text,
	processing_notes jsonb,
	user_id integer references public.users(user_id),
	action actions
);

create index uploads_id_index on public.uploads (upload_id);
create index uploads_collection_id_index on public.uploads (collection_id);




