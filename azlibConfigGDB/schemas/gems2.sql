--
-- PostgreSQL database dump
--

-- Dumped from database version 11.6
-- Dumped by pg_dump version 11.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: gems2; Type: SCHEMA; Schema: -; Owner: -
--

--CREATE SCHEMA gems2;


SET default_tablespace = '';

SET default_with_oids = false;

set search_path to $1; 


--
-- Name: ContactsAndFaults; Type: TABLE; Schema: gems2; Owner: -
--


CREATE TABLE "ContactsAndFaults" (
    "Type" text,
    "IsConcealed" text,
    "LocationConfidenceMeters" double precision,
    "ExistenceConfidence" text,
    "IdentityConfidence" text,
    "Symbol" text,
    "Label" text,
    "DataSourceID" text,
    "Notes" text,
    "ContactsAndFaults_ID" text,
    "Shape_Length" double precision,
    geom public.geometry,
    collection_id integer,
    feature_id integer NOT NULL
);


--
-- Name: ContactsAndFaults_feature_id_seq; Type: SEQUENCE; Schema: gems2; Owner: -
--

CREATE SEQUENCE "ContactsAndFaults_feature_id_seq"
    --AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ContactsAndFaults_feature_id_seq; Type: SEQUENCE OWNED BY; Schema: gems2; Owner: -
--

ALTER SEQUENCE "ContactsAndFaults_feature_id_seq" OWNED BY "ContactsAndFaults".feature_id;


--
-- Name: DataSources; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "DataSources" (
    "Source" text,
    "Notes" text,
    "URL" text,
    "DataSources_ID" text,
    collection_id integer
);


--
-- Name: DescriptionOfMapUnits; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "DescriptionOfMapUnits" (
    "MapUnit" text,
    "Name" text,
    "FullName" text,
    "Age" text,
    "Description" text,
    "HierarchyKey" text,
    "ParagraphStyle" text,
    "Label" text,
    "Symbol" text,
    "AreaFillRGB" text,
    "AreaFillPatternDescription" text,
    "DescriptionSourceID" text,
    "GeoMaterial" text,
    "GeoMaterialConfidence" text,
    "DescriptionOfMapUnits_ID" text,
    collection_id integer
);


--
-- Name: Glossary; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "Glossary" (
    "Term" text,
    "Definition" text,
    "DefinitionSourceID" text,
    "Glossary_ID" text,
    collection_id integer
);


--
-- Name: MapUnitPolys; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "MapUnitPolys" (
    "MapUnit" text,
    "IdentityConfidence" text,
    "Label" text,
    "Symbol" text,
    "DataSourceID" text,
    "Notes" text,
    "MapUnitPolys_ID" text,
    "Shape_Length" double precision,
    "Shape_Area" double precision,
    geom public.geometry,
    collection_id integer,
    feature_id integer NOT NULL
);


--
-- Name: MapUnitPolys_feature_id_seq; Type: SEQUENCE; Schema: gems2; Owner: -
--

CREATE SEQUENCE "MapUnitPolys_feature_id_seq"
    --AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: MapUnitPolys_feature_id_seq; Type: SEQUENCE OWNED BY; Schema: gems2; Owner: -
--

ALTER SEQUENCE "MapUnitPolys_feature_id_seq" OWNED BY "MapUnitPolys".feature_id;


--
-- Name: OrientationPoints; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "OrientationPoints" (
    "Type" text,
    "Azimuth" double precision,
    "Inclination" double precision,
    "Symbol" text,
    "Label" text,
    "LocationConfidenceMeters" double precision,
    "IdentityConfidence" text,
    "OrientationConfidenceDegrees" double precision,
    "PlotAtScale" double precision,
    "StationsID" text,
    "MapUnit" text,
    "LocationSourceID" text,
    "OrientationSourceID" text,
    "Notes" text,
    "OrientationPoints_ID" text,
    geom public.geometry,
    collection_id integer,
    feature_id integer NOT NULL
);


--
-- Name: OrientationPoints_feature_id_seq; Type: SEQUENCE; Schema: gems2; Owner: -
--

CREATE SEQUENCE "OrientationPoints_feature_id_seq"
    --AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: OrientationPoints_feature_id_seq; Type: SEQUENCE OWNED BY; Schema: gems2; Owner: -
--

ALTER SEQUENCE "OrientationPoints_feature_id_seq" OWNED BY "OrientationPoints".feature_id;


--
-- Name: Stations; Type: TABLE; Schema: gems2; Owner: -
--

CREATE TABLE "Stations" (
    "FieldID" text,
    "LocationConfidenceMeters" double precision,
    "ObservedMapUnit" text,
    "MapUnit" text,
    "Symbol" text,
    "Label" text,
    "PlotAtScale" double precision,
    "DataSourceID" text,
    "Notes" text,
    "LocationMethod" text,
    "TimeDate" timestamp with time zone,
    "Observer" text,
    "SignificantDimensionMeters" double precision,
    "GPSX" double precision,
    "GPSY" double precision,
    "PDOP" double precision,
    "MapX" double precision,
    "MapY" double precision,
    "Stations_ID" text,
    geom public.geometry,
    collection_id integer,
    feature_id integer NOT NULL
);


--
-- Name: Stations_feature_id_seq; Type: SEQUENCE; Schema: gems2; Owner: -
--

CREATE SEQUENCE "Stations_feature_id_seq"
    --AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Stations_feature_id_seq; Type: SEQUENCE OWNED BY; Schema: gems2; Owner: -
--

ALTER SEQUENCE "Stations_feature_id_seq" OWNED BY "Stations".feature_id;


--
-- Name: ContactsAndFaults feature_id; Type: DEFAULT; Schema: gems2; Owner: -
--

ALTER TABLE ONLY "ContactsAndFaults" ALTER COLUMN feature_id SET DEFAULT nextval('"ContactsAndFaults_feature_id_seq"'::regclass);


--
-- Name: MapUnitPolys feature_id; Type: DEFAULT; Schema: gems2; Owner: -
--

ALTER TABLE ONLY "MapUnitPolys" ALTER COLUMN feature_id SET DEFAULT nextval('"MapUnitPolys_feature_id_seq"'::regclass);


--
-- Name: OrientationPoints feature_id; Type: DEFAULT; Schema: gems2; Owner: -
--

ALTER TABLE ONLY "OrientationPoints" ALTER COLUMN feature_id SET DEFAULT nextval('"OrientationPoints_feature_id_seq"'::regclass);


--
-- Name: Stations feature_id; Type: DEFAULT; Schema: gems2; Owner: -
--

ALTER TABLE ONLY "Stations" ALTER COLUMN feature_id SET DEFAULT nextval('"Stations_feature_id_seq"'::regclass);


create table layers (
	layer_id serial primary key,
    name text not null,
    required boolean not null
);

insert into layers (name, required) values ('ContactsAndFaults', false);
insert into layers (name, required) values ('DescriptionOfMapUnits', true);
insert into layers (name, required) values ('DataSources', true);
insert into layers (name, required) values ('Glossary', false);
insert into layers (name, required) values ('MapUnitPolys', true);
insert into layers (name, required) values ('OrientationPoints', false);
insert into layers (name, required) values ('Stations', false);

