CREATE SCHEMA notes;

--Create a special type of accepted notes
CREATE TYPE note_type AS ENUM('misc','lithology','age','structure','economic','fossil');

--Create a special type of accepted dating methods
CREATE TYPE date_method AS ENUM('U/Pb','C14','U/Th','Ar/Ar','K/Ar','Rb/Sr','K/Ca','U/U','Kr/Kr','I/Xe','OSL','IRSL','La/Ba','La/Ce','Re/Os','Lu/Hf','Pb/Pb','Sm/Nd','Sr/Sr','Fission','Amino','Be-Cosmogenic','Al-Cosmogenic','Cl-Cosmogenic');

--This table holdes the location and basic metadata information for miscellaneous notes, meaning notes that do not fit into the AZGS data standard
CREATE TABLE notes.misc_notes (
	misc_note_id serial PRIMARY KEY,
	collection_id integer NOT NULL REFERENCES collections(collection_id),
	informal_name text NOT NULL,
	note_type note_type,
	azgs_path text NOT NULL,
	geom geometry -- if known
);

--This table holds the location and basic metadata information for notes meeting the AZGS standard
CREATE TABLE notes.standard_notes (
	standard_note_id serial PRIMARY KEY,
	collection_id integer REFERENCES collections(collection_id),
	station_id text NOT NULL, -- What the actual content creator called it
	early_interval_id integer REFERENCES dicts.intervals(int_id), 
	late_interval_id integer REFERENCES dicts.intervals(int_id),
	early_age numeric, -- Should add some checks to make sure number is compatible with interval
	late_age numeric,
	geom geometry NOT NULL,
	note_desc text,
	note_comments text,
	note_images integer[] --array of image_id's 
);

--This table describes notes matching age estimates taken from field data. This schema only allows a single dating type U/Pb per entry. If an individual hand sample has more than one date type, then it should be listed as separate entries (i.e., diff entry_id), but the station_id in notes.standard_notes should be the same
CREATE TABLE notes.standard_ages (
	standard_age_id integer PRIMARY KEY REFERENCES notes.standard_notes(standard_note_id),
	early_interval_id integer NOT NULL REFERENCES dicts.intervals(int_id), 
	late_interval_id integer NOT NULL REFERENCES dicts.intervals(int_id),
	early_age numeric, -- Should add some checks to make sure number is compatible with interval
	late_age numeric,
	absolute_dates boolean NOT NULL,
	index_fossils text[],
	dated_age numeric[] CHECK (cardinality(dated_age)=cardinality(dated_age_se) IS TRUE),
	dated_age_se numeric[],
	dating_method date_method, 
	dating_laboratory text, -- where the analysis was performed
	date_comments text -- additional comments
);

--This table desribes notes describing the lithology of a specimen. Users can add whatever they want in the base sample description and comments field in notes.standard_notes, but this section will be limited to options from the macrostrat dictionaries. It's true that this concat string format is not third normal form, but works for our purposes.
CREATE TABLE notes.standard_lithologies (
	standard_lithology_id integer PRIMARY KEY REFERENCES notes.standard_notes(standard_note_id),
	lith_class text[],
	lith_group text[],
	lith_type text[],
	lith_names text[],
	mineral_names text[],
	sedimentary_structures text[],
	environment_name text[] 
);

--Create a percentage of minerals
CREATE TABLE notes.mineral_percentages (
	mineral_percentage_id serial PRIMARY KEY,
	standard_note_id integer NOT NULL REFERENCES notes.standard_notes(standard_note_id),
	mineral_id integer NOT NULL REFERENCES dicts.minerals(mineral_id),
	mineral_percent numeric NOT NULL
);

--Create a percentage of grain size
CREATE TABLE notes.grain_sizes (
	grain_size_id serial PRIMARY KEY,
	standard_note_id integer NOT NULL REFERENCES notes.standard_notes(standard_note_id),
	grain_id integer NOT NULL REFERENCES dicts.grainsize(grain_id),
	grain_percent numeric NOT NULL
);

CREATE TABLE notes.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null
);
