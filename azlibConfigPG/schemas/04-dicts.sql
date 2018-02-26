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

COPY dicts.minerals FROM PROGRAM 'curl "https://macrostrat.org/api/v2/defs/minerals?all&format=csv"' WITH CSV HEADER;

COPY dicts.lithologies FROM PROGRAM 'curl "https://macrostrat.org/api/V2/defs/lithologies?all&format=csv"' WITH CSV HEADER;

COPY dicts.intervals FROM PROGRAM 'curl "https://macrostrat.org/api/V2/defs/intervals?all&format=csv"' WITH CSV HEADER;

COPY dicts.lith_attr FROM PROGRAM 'curl "https://macrostrat.org/api/V2/defs/lithology_attributes?all&format=csv"' WITH CSV HEADER;

COPY dicts.environments FROM PROGRAM 'curl "https://macrostrat.org/api/V2/defs/environments?all&format=csv"' WITH CSV HEADER;

COPY dicts.grainsize FROM PROGRAM 'curl "https://dev.macrostrat.org/api/V2/defs/grainsizes?all&format=csv"' WITH CSV HEADER;

