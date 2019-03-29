--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.6
-- Dumped by pg_dump version 10.3 (Ubuntu 10.3-1.pgdg16.04+1)

-- Started on 2018-09-27 16:11:56 MST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 16 (class 2615 OID 6855035)
-- Name: ncgmp09; Type: SCHEMA; Schema: -; Owner: -
--

--CREATE SCHEMA ncgmp09;


SET default_tablespace = '';

SET default_with_oids = false;

--
-- TOC entry 262 (class 1259 OID 6855082)
-- Name: ContactsAndFaults; Type: TABLE; Schema: ncgmp09; Owner: -
--

set search_path to $1; 

CREATE TABLE "ContactsAndFaults" (
    "OBJECTID" integer NOT NULL,
    "Shape_Length" double precision,
    "ContactsAndFaults_ID" character varying(50),
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
    geom public.geometry(MultiLineString,4326),
    collection_id integer
);


--
-- TOC entry 261 (class 1259 OID 6855080)
-- Name: ContactsAndFaults_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "ContactsAndFaults_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3879 (class 0 OID 0)
-- Dependencies: 261
-- Name: ContactsAndFaults_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "ContactsAndFaults_OBJECTID_seq" OWNED BY "ContactsAndFaults"."OBJECTID";


--
-- TOC entry 266 (class 1259 OID 6855272)
-- Name: DescriptionOfMapUnits; Type: TABLE; Schema: ncgmp09; Owner: -
--

CREATE TABLE "DescriptionOfMapUnits" (
    "OBJECTID" integer NOT NULL,
    "DescriptionOfMapUnits_ID" character varying(50),
    "MapUnit" character varying(10),
    "Label" character varying(50),
    "Name" character varying(254),
    "FullName" character varying(254),
    "Age" character varying(254),
    "Description" character varying,
    "GeneralLithology" character varying(254),
    "GeneralLithologyConfidence" character varying(254),
    "HierarchyKey" character varying(254),
    "ParagraphStyle" character varying(254),
    "Symbol" character varying(254),
    "AreaFillRGB" character varying(254),
    "AreaFillPatternDescription" character varying(254),
    "DescriptionSourceID" character varying(50),
    collection_id integer
);


--
-- TOC entry 265 (class 1259 OID 6855270)
-- Name: DescriptionOfMapUnits_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "DescriptionOfMapUnits_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3880 (class 0 OID 0)
-- Dependencies: 265
-- Name: DescriptionOfMapUnits_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "DescriptionOfMapUnits_OBJECTID_seq" OWNED BY "DescriptionOfMapUnits"."OBJECTID";


--
-- TOC entry 270 (class 1259 OID 6855677)
-- Name: Glossary; Type: TABLE; Schema: ncgmp09; Owner: -
--

CREATE TABLE "Glossary" (
    "OBJECTID" integer NOT NULL,
    "Glossary_ID" character varying(50),
    "Term" character varying(254),
    "Definition" character varying,
    "DefinitionSourceID" character varying(50),
    collection_id integer
);


--
-- TOC entry 269 (class 1259 OID 6855675)
-- Name: Glossary_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "Glossary_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3881 (class 0 OID 0)
-- Dependencies: 269
-- Name: Glossary_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "Glossary_OBJECTID_seq" OWNED BY "Glossary"."OBJECTID";


--
-- TOC entry 260 (class 1259 OID 6855038)
-- Name: MapUnitPolys; Type: TABLE; Schema: ncgmp09; Owner: -
--

CREATE TABLE "MapUnitPolys" (
    "OBJECTID" integer NOT NULL,
    "Shape_Length" double precision,
    "Shape_Area" double precision,
    "MapUnitPolys_ID" character varying(50),
    "MapUnit" character varying(10),
    "IdentityConfidence" character varying(50),
    "Label" character varying(50),
    "Symbol" character varying(254),
    "Notes" character varying,
    "DataSourceID" character varying(50),
    geom public.geometry(MultiPolygon,4326),
    collection_id integer
);


--
-- TOC entry 259 (class 1259 OID 6855036)
-- Name: MapUnitPolys_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "MapUnitPolys_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3882 (class 0 OID 0)
-- Dependencies: 259
-- Name: MapUnitPolys_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "MapUnitPolys_OBJECTID_seq" OWNED BY "MapUnitPolys"."OBJECTID";


--
-- TOC entry 264 (class 1259 OID 6855224)
-- Name: OrientationPoints; Type: TABLE; Schema: ncgmp09; Owner: -
--

CREATE TABLE "OrientationPoints" (
    "OBJECTID" integer NOT NULL,
    "OrientationPoints_ID" character varying(50),
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
    "RuleID" integer,
    "Override" bytea,
    geom public.geometry(Point,4326),
    collection_id integer
);


--
-- TOC entry 263 (class 1259 OID 6855222)
-- Name: OrientationPoints_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "OrientationPoints_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3883 (class 0 OID 0)
-- Dependencies: 263
-- Name: OrientationPoints_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "OrientationPoints_OBJECTID_seq" OWNED BY "OrientationPoints"."OBJECTID";


--
-- TOC entry 268 (class 1259 OID 6855377)
-- Name: Stations; Type: TABLE; Schema: ncgmp09; Owner: -
--

CREATE TABLE "Stations" (
    "OBJECTID" integer NOT NULL,
    "Stations_ID" character varying(50),
    "FieldID" character varying(50),
    "MapUnit" character varying(10),
    "Symbol" character varying(254),
    "Label" character varying(50),
    "PlotAtScale" real,
    "LocationConfidenceMeters" real,
    "LocationMethod" character varying(254),
    "TimeDate" timestamp with time zone,
    "Observer" character varying(254),
    "SignificantDimensionMeters" real,
    "GPSX" real,
    "GPSY" real,
    "PDOP" real,
    "MapX" real,
    "MapY" real,
    "DataSourceID" character varying(50),
    "Notes" character varying,
    geom public.geometry(Point,4326),
    collection_id integer
);


--
-- TOC entry 267 (class 1259 OID 6855375)
-- Name: Stations_OBJECTID_seq; Type: SEQUENCE; Schema: ncgmp09; Owner: -
--

CREATE SEQUENCE "Stations_OBJECTID_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3884 (class 0 OID 0)
-- Dependencies: 267
-- Name: Stations_OBJECTID_seq; Type: SEQUENCE OWNED BY; Schema: ncgmp09; Owner: -
--

ALTER SEQUENCE "Stations_OBJECTID_seq" OWNED BY "Stations"."OBJECTID";


--
-- TOC entry 3723 (class 2604 OID 6855085)
-- Name: ContactsAndFaults OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "ContactsAndFaults" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"ContactsAndFaults_OBJECTID_seq"'::regclass);


--
-- TOC entry 3725 (class 2604 OID 6855275)
-- Name: DescriptionOfMapUnits OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "DescriptionOfMapUnits" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"DescriptionOfMapUnits_OBJECTID_seq"'::regclass);


--
-- TOC entry 3727 (class 2604 OID 6855680)
-- Name: Glossary OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Glossary" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"Glossary_OBJECTID_seq"'::regclass);


--
-- TOC entry 3722 (class 2604 OID 6855041)
-- Name: MapUnitPolys OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "MapUnitPolys" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"MapUnitPolys_OBJECTID_seq"'::regclass);


--
-- TOC entry 3724 (class 2604 OID 6855227)
-- Name: OrientationPoints OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "OrientationPoints" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"OrientationPoints_OBJECTID_seq"'::regclass);


--
-- TOC entry 3726 (class 2604 OID 6855380)
-- Name: Stations OBJECTID; Type: DEFAULT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Stations" ALTER COLUMN "OBJECTID" SET DEFAULT nextval('"Stations_OBJECTID_seq"'::regclass);


--
-- TOC entry 3733 (class 2606 OID 6855090)
-- Name: ContactsAndFaults ContactsAndFaults_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "ContactsAndFaults"
    ADD CONSTRAINT "ContactsAndFaults_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3738 (class 2606 OID 6855280)
-- Name: DescriptionOfMapUnits DescriptionOfMapUnits_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "DescriptionOfMapUnits"
    ADD CONSTRAINT "DescriptionOfMapUnits_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3743 (class 2606 OID 6855685)
-- Name: Glossary Glossary_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Glossary"
    ADD CONSTRAINT "Glossary_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3730 (class 2606 OID 6855046)
-- Name: MapUnitPolys MapUnitPolys_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "MapUnitPolys"
    ADD CONSTRAINT "MapUnitPolys_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3736 (class 2606 OID 6855232)
-- Name: OrientationPoints OrientationPoints_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "OrientationPoints"
    ADD CONSTRAINT "OrientationPoints_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3741 (class 2606 OID 6855385)
-- Name: Stations Stations_pkey; Type: CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Stations"
    ADD CONSTRAINT "Stations_pkey" PRIMARY KEY ("OBJECTID");


--
-- TOC entry 3731 (class 1259 OID 6855091)
-- Name: ContactsAndFaults_geom_geom_idx; Type: INDEX; Schema: ncgmp09; Owner: -
--

CREATE INDEX "ContactsAndFaults_geom_geom_idx" ON "ContactsAndFaults" USING gist (geom);


--
-- TOC entry 3728 (class 1259 OID 6855047)
-- Name: MapUnitPolys_geom_geom_idx; Type: INDEX; Schema: ncgmp09; Owner: -
--

CREATE INDEX "MapUnitPolys_geom_geom_idx" ON "MapUnitPolys" USING gist (geom);


--
-- TOC entry 3734 (class 1259 OID 6855233)
-- Name: OrientationPoints_geom_geom_idx; Type: INDEX; Schema: ncgmp09; Owner: -
--

CREATE INDEX "OrientationPoints_geom_geom_idx" ON "OrientationPoints" USING gist (geom);


--
-- TOC entry 3739 (class 1259 OID 6855386)
-- Name: Stations_geom_geom_idx; Type: INDEX; Schema: ncgmp09; Owner: -
--

CREATE INDEX "Stations_geom_geom_idx" ON "Stations" USING gist (geom);


--
-- TOC entry 3745 (class 2606 OID 6855982)
-- Name: ContactsAndFaults ContactsAndFaults_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "ContactsAndFaults"
    ADD CONSTRAINT "ContactsAndFaults_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


--
-- TOC entry 3747 (class 2606 OID 6856142)
-- Name: DescriptionOfMapUnits DescriptionOfMapUnits_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "DescriptionOfMapUnits"
    ADD CONSTRAINT "DescriptionOfMapUnits_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


--
-- TOC entry 3749 (class 2606 OID 6856152)
-- Name: Glossary Glossary_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Glossary"
    ADD CONSTRAINT "Glossary_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


--
-- TOC entry 3744 (class 2606 OID 6855952)
-- Name: MapUnitPolys MapUnitPolys_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "MapUnitPolys"
    ADD CONSTRAINT "MapUnitPolys_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


--
-- TOC entry 3746 (class 2606 OID 6856002)
-- Name: OrientationPoints OrientationPoints_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "OrientationPoints"
    ADD CONSTRAINT "OrientationPoints_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


--
-- TOC entry 3748 (class 2606 OID 6855957)
-- Name: Stations Stations_collection_id_fkey; Type: FK CONSTRAINT; Schema: ncgmp09; Owner: -
--

ALTER TABLE ONLY "Stations"
    ADD CONSTRAINT "Stations_collection_id_fkey" FOREIGN KEY (collection_id) REFERENCES public.collections(collection_id);


-- Completed on 2018-09-27 16:11:56 MST

--
-- PostgreSQL database dump complete
--

create table layers (
	layer_id serial primary key,
    name text not null,
    required boolean not null
);

insert into layers (name, required) values ('ContactsAndFaults', false);
insert into layers (name, required) values ('DescriptionOfMapUnits', true);
insert into layers (name, required) values ('Glossary', false);
insert into layers (name, required) values ('MapUnitPolys', true);
insert into layers (name, required) values ('OrientationPoints', false);
insert into layers (name, required) values ('Stations', false);



