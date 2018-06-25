CREATE SCHEMA dicts;

CREATE TABLE dicts.minerals
(
	mineral_id integer NOT NULL,
	mineral text,
	mineral_type text,
	formula text,
	formula_tags text,
	url text,
	CONSTRAINT minerals_pkey PRIMARY KEY (mineral_id)
);

CREATE TABLE dicts.lithologies
(
	lith_id integer NOT NULL,
	name text,
	type text,
	"group" text,
	class text,
	color text,
	fill integer,
	t_units integer,
	CONSTRAINT lithologies_pkey PRIMARY KEY (lith_id)
);

CREATE TABLE dicts.intervals
(
	int_id integer NOT NULL,
	name text,
	abbrev text,
	t_age double precision,
	b_age double precision,
	int_type text,
	timescales text,
	color text,
	CONSTRAINT intervals_pkey PRIMARY KEY (int_id)
);

CREATE TABLE dicts.lith_attr
(
	lith_att_id integer NOT NULL,
	name text,
	type text,
	t_units integer,
	CONSTRAINT lith_attr_pkey PRIMARY KEY (lith_att_id)
);

CREATE TABLE dicts.environments
(
	environ_id integer NOT NULL,
	name text,
	type text,
	class text,
	color text,
	t_units integer,
	CONSTRAINT environments_pkey PRIMARY KEY (environ_id)
);

CREATE TABLE dicts.grainsize
(
	grain_id integer NOT NULL,
	grain_symbol text,
	grain_name text,
	grain_group text,
	soil_group text,
	min_size double precision,
	max_size double precision,
	classification text,
	CONSTRAINT grainsize_pkey PRIMARY KEY (grain_id)
);

CREATE TABLE dicts.languages (
	language_id serial PRIMARY KEY,
    language_name text,
    iso639_2 text,
    iso639_3 text,
    iso639_1 text
);

CREATE TABLE dicts.arizona_places (
    arizona_place_id integer primary key,
    arizona_place_name text,
    name_formal text,
    placetype text,
    iso2 text,
    iso3 text,
    continent integer,
    country integer,
    region integer,
    county integer,
    locality integer,
    other_names hstore,
    geom geometry,
    within_arizona boolean
);

--COMMENT ON TABLE wof_arizona IS 'This is a subset of Macrostrats WOF database (from MapZen). It has all known localities within a 10° buffer of the state of arizona. Localities contained strictly within the state of Arizona are marked in the within_arizona field. This table is not 3rd normal order because the other_names field (foreign language names) is text string that must be parsed. The index for language acronyms is in the wof_languages table.';
DO
$do$
BEGIN
EXECUTE format($$COMMENT ON TABLE dicts.arizona_places IS 'This is a subset of Macrostrats WOF database (from MapZen). It has all known localities within a 10° buffer of the state of arizona. Localities contained strictly within the state of Arizona are marked in the within_arizona field. This table is not 3rd normal order because the other_names field (foreign language names) is text string that must be parsed. The index for language acronyms is in the wof_languages table.';
$$);
END
$do$;

CREATE INDEX arizona_places_geom_idx ON dicts.arizona_places USING gist (geom);



COPY dicts.minerals  FROM PROGRAM 'curl  "https://macrostrat.org/api/v2/defs/minerals?all&format=csv" | csvtool namedcol mineral_id,mineral,mineral_type,formula,formula_tags,url - ' WITH CSV HEADER;

COPY dicts.lithologies  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/lithologies?all&format=csv" | csvtool namedcol lith_id,name,type,group,class,color,fill,t_units - ' WITH CSV HEADER;

COPY dicts.intervals  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/intervals?all&format=csv" | csvtool namedcol int_id,name,abbrev,t_age,b_age,int_type,timescales,color - ' WITH CSV HEADER;

COPY dicts.lith_attr  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/lithology_attributes?all&format=csv" | csvtool namedcol lith_att_id,name,type,t_units - ' WITH CSV HEADER;

COPY dicts.environments  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/environments?all&format=csv" | csvtool namedcol environ_id,name,type,class,color,t_units - ' WITH CSV HEADER;

COPY dicts.grainsize  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/grainsizes?all&format=csv" | csvtool namedcol grain_id,grain_symbol,grain_name,grain_group,soil_group,min_size,max_size,classification - ' WITH CSV HEADER;

