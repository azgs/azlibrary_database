CREATE SCHEMA metadata;

create table metadata.types
(
	type_name text primary key,
	title_query_path text,
	minx_query_path text,
	maxx_query_path text,
	miny_query_path text,
	maxy_query_path text,
	series_query_path text,
	authors_query_path text,
	year_query_path text,
	keywords_query_path text
);
insert into metadata.types (type_name) values ('FGDC');

insert into metadata.types (
	type_name, 
	title_query_path, 
	minx_query_path, 
	maxx_query_path, 
	miny_query_path, 
	maxy_query_path,
	series_query_path,
	authors_query_path,
	year_query_path,
	keywords_query_path

) values ( --TODO: These fields are just for development
	'AZGS',
	$$json_data->>'title'$$,
	$$json_data->>'minx'$$,
	$$json_data->>'maxx'$$,
	$$json_data->>'miny'$$,
	$$json_data->>'maxy'$$,
	$$json_data#>'{"series"}'$$,
	$$json_data#>'{"author"}'$$,
	$$json_data->>'year'$$,
	$$json_data#>'{"keyword"}'$$
);

insert into metadata.types (
	type_name, 
	title_query_path, 
	minx_query_path, 
	maxx_query_path, 
	miny_query_path, 
	maxy_query_path,
	series_query_path,
	authors_query_path,
	year_query_path,
	keywords_query_path

) values (
	'ISO19139',
	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:citation'->0->
						'gmd:CI_Citation'->0->
							'gmd:title'->0->
								'gco:CharacterString'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:westBoundLongitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:eastBoundLongitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:southBoundLatitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:northBoundLatitude'->0->
										'gco:Decimal'->>0$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:identifier"}'
	) 
	--#>> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString",0}'$$,
	#> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString"}'$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:citedResponsibleParty"}'
	) 
	--#>> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString",0}'$$,
	#> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString"}'$$,

	$$extract(year from (jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:date"}'
	) 
	#>> '{"gmd:CI_Date", 0, "gmd:date", 0, "gco:DateTime",0}')::date)###
	extract(year from (jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:date"}'
	) 
	#>> '{"gmd:CI_Date", 0, "gmd:date", 0, "gco:Date",0}')::date)$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			jsonb_array_elements(
				json_data #> 
				'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
			) 
			#> '{"gmd:MD_DataIdentification", 0, "gmd:descriptiveKeywords"}'
		) 
		#> '{"gmd:MD_Keywords",0, "gmd:keyword"}'
	--) #>> '{"gco:CharacterString",0}'$$
	) #> '{"gco:CharacterString"}'$$
);
insert into metadata.types (
	type_name, 
	title_query_path, 
	minx_query_path, 
	maxx_query_path, 
	miny_query_path, 
	maxy_query_path,
	series_query_path,
	authors_query_path,
	year_query_path,
	keywords_query_path
) values (
	'ISO19115', 
	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:citation'->0->
						'gmd:CI_Citation'->0->
							'gmd:title'->0->
								'gco:CharacterString'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:westBoundLongitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:eastBoundLongitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:southBoundLatitude'->0->
										'gco:Decimal'->>0$$,

	$$json_data->
		'gmd:MD_Metadata'->
			'gmd:identificationInfo'->0->
				'gmd:MD_DataIdentification'->0->
					'gmd:extent'->0->
						'gmd:EX_Extent'->0->
							'gmd:geographicElement'->0->
								'gmd:EX_GeographicBoundingBox'->0->
									'gmd:northBoundLatitude'->0->
										'gco:Decimal'->>0$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:identifier"}'
	) 
	--#>> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString",0}'$$,
	#> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString"}'$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:citedResponsibleParty"}'
	) 
	--#>> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString",0}'$$,
	#> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString"}'$$,

	$$extract(year from (jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:date"}'
	) 
	#>> '{"gmd:CI_Date", 0, "gmd:date", 0, "gco:DateTime",0}')::date)###
	extract(year from (jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:date"}'
	) 
	#>> '{"gmd:CI_Date", 0, "gmd:date", 0, "gco:Date",0}')::date)$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			jsonb_array_elements(
				json_data #> 
				'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
			) 
			#> '{"gmd:MD_DataIdentification", 0, "gmd:descriptiveKeywords"}'
		) 
		#> '{"gmd:MD_Keywords",0, "gmd:keyword"}'
	--) #>> '{"gco:CharacterString",0}'$$
	) #> '{"gco:CharacterString"}'$$
);

CREATE TABLE metadata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	title_search tsvector,
	author_search tsvector,
	keyword_search tsvector,
	series_search tsvector,
	kitchensink_search tsvector,
	metadata_file text not null,
	geom geometry
);

CREATE FUNCTION metadata.title_trigger() RETURNS trigger AS $$
declare
	json_path text;
	title_query text;
	title_result text;

begin
	--Get the query path for this metadata type
	select title_query_path into json_path from metadata.types where type_name = new.type;

	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	title_query := 'select ' || json_path || ' from tabletemp'; --TODO: Use format here
	execute title_query into title_result;

	--Get the thing we're after
	new.title_search := to_tsvector('pg_catalog.english', title_result);
	return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER titleTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.title_trigger();

CREATE FUNCTION metadata.author_trigger() RETURNS trigger AS $$
declare
	json_path text;
	author_query text;
	author_result text;

begin

	--Get the query path for this metadata type
	select authors_query_path into json_path from metadata.types where type_name = new.type;

	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	author_query := $jq$  
		SELECT  
			k.authors
		FROM (
			SELECT 
				string_agg(author, ';') as authors
			FROM (
				select jsonb_array_elements_text($jq$ || json_path || $jq$ 
				)  as author from tabletemp
			) as a
		) k$jq$;
	execute author_query into author_result;

	--Get the thing we're after
	new.author_search := to_tsvector('pg_catalog.english', author_result);
	return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER authorTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.author_trigger();

CREATE FUNCTION metadata.keyword_trigger() RETURNS trigger AS $$
declare
	json_path text;
	keyword_query text;
	keyword_result text;

begin

	--Get the query path for this metadata type
	select keywords_query_path into json_path from metadata.types where type_name = new.type;

	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	keyword_query := $jq$  
		SELECT  
			k.keywords
		FROM (
			SELECT 
				string_agg(keyword, ';') as keywords
			FROM (
				select jsonb_array_elements_text($jq$ || json_path || $jq$ 
				)  as keyword from tabletemp
			) as a
		) k$jq$;
	execute keyword_query into keyword_result;

	--Get the thing we're after
	new.keyword_search := to_tsvector('pg_catalog.english', keyword_result);
  return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER keywordTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.keyword_trigger();

CREATE FUNCTION metadata.series_trigger() RETURNS trigger AS $$
declare
	json_path text;
	series_query text;
	series_result text;

begin

	--Get the query path for this metadata type
	select series_query_path into json_path from metadata.types where type_name = new.type;

	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	series_query := $jq$  
		SELECT  
			k.series
		FROM (
			SELECT 
				string_agg(serial, ';') as series
			FROM (
				select jsonb_array_elements_text($jq$ || json_path || $jq$ 
				)  as serial from tabletemp
			) as a
		) k$jq$;
	execute series_query into series_result;

	--Get the thing we're after
	new.series_search := to_tsvector('pg_catalog.english', series_result);
  return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER seriesTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.series_trigger();


/*
CREATE TABLE metadata.json_entries
(
	json_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	type text references metadata.types(type_name),
	metadata jsonb,
	metadata_file text
);

CREATE TABLE metadata.xml_entries
(
	xml_entry_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id), 
	type text references metadata.types(type_name) not null,
	textdata text,
	--xmldata text, This does not behave as expected. Might revisit later.
	metadata_file text
);
*/
