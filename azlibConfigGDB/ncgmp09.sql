create table ncgmp09.cross_sections (
	cross_section_id serial PRIMARY KEY,
	cross_section_prefix text
);

insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSA');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSB');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSC');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSD');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSE');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSF');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSG');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSH');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSI');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSJ');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSK');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSL');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSM');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSN');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSO');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSP');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSQ');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSR');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSS');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CST');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSU');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSV');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSW');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSX');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSY');
insert into ncgmp09.cross_sections (cross_section_prefix) values ('CSZ');

create table ncgmp09.cs_MapUnitPolys (
	cs_MapUnitPolys_id serial PRIMARY KEY,
	cross_section_id integer references ncgmp09.cross_sections(cross_section_id),
	"OBJECTID" integer NOT NULL,
	"CSAMapUnitPolys_ID" character varying(50),
	"MapUnit" character varying(10),
	"IdentityConfidence" character varying(50),
	"Label" character varying(50),
	"Symbol" character varying(254),
	"Notes" character varying,
	"DataSourceID" character varying(50),
	"Shape_Length" double precision,
	"Shape_Area" double precision,
	geom geometry(MultiPolygon,26912),
	collection_id integer REFERENCES public.collections (collection_id)
);

create table ncgmp09.cs_ContactsAndFaults (
	cs_ContactsAndFaults_id serial PRIMARY KEY,
	cross_section_id integer references ncgmp09.cross_sections(cross_section_id),
	"OBJECTID" integer NOT NULL,
	"CSAContactsAndFaults_ID" character varying(50),
	"Type" character varying(254),
	"IsConcealed" character varying(1),
	"ExistenceConfidence" character varying(50),
	"IdentityConfidence" character varying(50),
	"LocationConfidenceMeters" real,
	"Symbol" character varying(254),
	"Label" character varying(50),
	"DataSourceID" character varying(50),
	"Notes" character varying,
	"LTYPE" character varying(255),
	"RuleID" integer,
	"Override" bytea,
	"Shape_Length" double precision,
	geom geometry(MultiLineString,26912),
	collection_id integer REFERENCES public.collections (collection_id)
);

create table ncgmp09.cs_OrientationPoints (
	cs_OrientationPoints_id serial PRIMARY KEY,
	cross_section_id integer references ncgmp09.cross_sections(cross_section_id),
	"OBJECTID" integer NOT NULL,
	"CSAOrientationPoints_ID" character varying(50),
	"Type" character varying(254),
	"StationID" character varying(50),
	"MapUnit" character varying(10),
	"Symbol" character varying(254),
	"Label" character varying(50),
	"PlotAtScale" real,
	"LocationConfidenceMeters" real,
	"Azimuth" real,
	"Inclination" real,
	"IdentityConfidence" character varying(50),
	"OrientationConfidenceDegrees" real,
	"LocationSourceID" character varying(50),
	"DataSourceID" character varying(50),
	"Notes" character varying,
	"SymbolRotation" double precision,
	"PTTYPE" character varying(255),
	geom geometry(Point,26912),
	collection_id integer REFERENCES public.collections (collection_id)
);

