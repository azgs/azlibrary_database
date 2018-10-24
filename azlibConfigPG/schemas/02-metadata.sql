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
	#>> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString",0}'$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:citedResponsibleParty"}'
	) 
	#>> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString",0}'$$,

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
	) #>> '{"gco:CharacterString",0}'$$
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
	#>> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString",0}'$$,

	$$jsonb_array_elements(
		jsonb_array_elements(
			json_data #> 
			'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
		) 
		#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:citedResponsibleParty"}'
	) 
	#>> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString",0}'$$,

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
	) #>> '{"gco:CharacterString",0}'$$
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
begin
  new.title_search :=
     to_tsvector('pg_catalog.english', (
		select 
			new.json_data->
				'gmd:MD_Metadata'->
					'gmd:identificationInfo'->0->
						'gmd:MD_DataIdentification'->0->
							'gmd:citation'->0->
								'gmd:CI_Citation'->0->
									'gmd:title'->0->
										'gco:CharacterString'->>0));
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER titleTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.title_trigger();

CREATE FUNCTION metadata.author_trigger() RETURNS trigger AS $$
begin
  new.author_search :=
     to_tsvector('pg_catalog.english', (
		SELECT  
			k.authors
		FROM 
				(SELECT 
					string_agg(author, ';') as authors
				FROM (
		
					select jsonb_array_elements_text(
						jsonb_array_elements(
							jsonb_array_elements(
								new.json_data #> 
								'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
							) 
							#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:citedResponsibleParty"}'
						) 
						#> '{"gmd:CI_ResponsibleParty", 0, "gmd:individualName", 0, "gco:CharacterString"}'
					) author
				) as a
			) k));
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER authorTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.author_trigger();

CREATE FUNCTION metadata.keyword_trigger() RETURNS trigger AS $$
begin
  new.keyword_search :=
     to_tsvector('pg_catalog.english', (
		SELECT  
			k.keywords
		FROM 
				(SELECT 
					string_agg(keyword, ',') as keywords
				FROM (
		
					select jsonb_array_elements_text(
						jsonb_array_elements(
							jsonb_array_elements(
								jsonb_array_elements(
									new.json_data #> 
									'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
								) 
								#> '{"gmd:MD_DataIdentification", 0, "gmd:descriptiveKeywords"}'
							) 
							#> '{"gmd:MD_Keywords",0, "gmd:keyword"}'
						) 
						#>'{"gco:CharacterString"}'
					) keyword
				) as a
			) k));
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER keywordTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.metadata FOR EACH ROW EXECUTE PROCEDURE metadata.keyword_trigger();

CREATE FUNCTION metadata.series_trigger() RETURNS trigger AS $$
begin
  new.series_search :=
     to_tsvector('pg_catalog.english', (
		SELECT  
			k.series
		FROM 
				(SELECT 
					string_agg(serial, ';') as series
				FROM (
					select jsonb_array_elements_text(
						jsonb_array_elements(
							jsonb_array_elements(
								new.json_data #> 
								'{"gmd:MD_Metadata", "gmd:identificationInfo"}'					
							) 
							#> '{"gmd:MD_DataIdentification", 0, "gmd:citation", 0, "gmd:CI_Citation", 0, "gmd:identifier"}'
						) 
						#> '{"gmd:MD_Identifier", 0, "gmd:code", 0, "gco:CharacterString"}'
					) serial
				) as a
			) k));
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
