CREATE SCHEMA metadata;

create table metadata.types
(
	type_name text primary key,
	title_query_path text,
	minx_query_path text,
	maxx_query_path text,
	miny_query_path text,
	maxy_query_path text
);
insert into metadata.types (type_name) values ('FGDC');
insert into metadata.types (
	type_name, 
	title_query_path, 
	minx_query_path, 
	maxx_query_path, 
	miny_query_path, 
	maxy_query_path
) values (
	'ISO19139',
	$$'gmd:MD_Metadata'->
		'gmd:identificationInfo'->0->
			'gmd:MD_DataIdentification'->0->
				'gmd:citation'->0->
					'gmd:CI_Citation'->0->
						'gmd:title'->0->
							'gco:CharacterString'->>0$$,
	$$'gmd:MD_Metadata'->
		'gmd:identificationInfo'->0->
			'gmd:MD_DataIdentification'->0->
				'gmd:extent'->0->
					'gmd:EX_Extent'->0->
						'gmd:geographicElement'->0->
							'gmd:EX_GeographicBoundingBox'->0->
								'gmd:westBoundLongitude'->0->
									'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:eastBoundLongitude'->0->
								'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:southBoundLatitude'->0->
								'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:northBoundLatitude'->0->
								'gco:Decimal'->>0$$
);
insert into metadata.types (
	type_name, 
	title_query_path, 
	minx_query_path, 
	maxx_query_path, 
	miny_query_path, 
	maxy_query_path
) values (
	'ISO19115', 
	$$'gmd:MD_Metadata'->
		'gmd:identificationInfo'->0->
			'gmd:MD_DataIdentification'->0->
				'gmd:citation'->0->
					'gmd:CI_Citation'->0->
						'gmd:title'->0->
							'gco:CharacterString'->>0$$,
	$$'gmd:MD_Metadata'->
		'gmd:identificationInfo'->0->
			'gmd:MD_DataIdentification'->0->
				'gmd:extent'->0->
					'gmd:EX_Extent'->0->
						'gmd:geographicElement'->0->
							'gmd:EX_GeographicBoundingBox'->0->
								'gmd:westBoundLongitude'->0->
									'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:eastBoundLongitude'->0->
								'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:southBoundLatitude'->0->
								'gco:Decimal'->>0$$,
	$$'gmd:MD_Metadata'->
	'gmd:identificationInfo'->0->
		'gmd:MD_DataIdentification'->0->
			'gmd:extent'->0->
				'gmd:EX_Extent'->0->
					'gmd:geographicElement'->0->
						'gmd:EX_GeographicBoundingBox'->0->
							'gmd:northBoundLatitude'->0->
								'gco:Decimal'->>0$$
);

CREATE TABLE metadata.metadata
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	type text references metadata.types(type_name) not null,
	json_data jsonb not null,
	metadata_file text not null,
	geom geometry
);


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
