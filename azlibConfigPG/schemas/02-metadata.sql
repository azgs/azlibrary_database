CREATE SCHEMA metadata;


CREATE TABLE metadata.azgs
(
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id) not null, 
	json_data jsonb not null,
	title_search tsvector,
	author_search tsvector,
	keyword_search tsvector,
	series_search tsvector,
	kitchensink_search tsvector,
	geom geometry
);
CREATE INDEX azgs_id_idx ON metadata.azgs (metadata_id);
CREATE INDEX azgs_geom_idx ON metadata.azgs using gist(geom);
CREATE INDEX azgs_title_idx ON metadata.azgs USING gin(title_search);
CREATE INDEX azgs_author_idx ON metadata.azgs USING gin(author_search);
CREATE INDEX azgs_keyword_idx ON metadata.azgs USING gin(keyword_search);
CREATE INDEX azgs_series_idx ON metadata.azgs USING gin(series_search);
CREATE INDEX azgs_kitchensink_idx ON metadata.azgs USING gin(kitchensink_search);


CREATE TABLE metadata.metadata (
	metadata_id serial PRIMARY KEY,
	collection_id integer REFERENCES public.collections(collection_id),
	metadata_file text not null
);

CREATE INDEX metadata_id_idx ON metadata.metadata (metadata_id);

CREATE FUNCTION metadata.collections_trigger() RETURNS trigger AS $$
declare
	json_path text;
	collection_group_query text;
	collection_group_result integer;
	title_query text;
	title_result text;
	informal_query text;
	informal_result text;
	supersedes_query text;
	supersedes_result text;
	superseded_by_query text;
	superseded_by_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);

	collection_group_query := $cq$
		select
		 	cg.collection_group_id
		from
			public.collection_groups cg
		where
			cg.collection_group_name = (
				select
					json_data->'collection_group'->>'name'
				from
					tabletemp
			)
	$cq$; 
	execute collection_group_query into collection_group_result;

	title_query := $jq$
		select 
			json_data->>'title' 
		from tabletemp
	$jq$; 
	execute title_query into title_result;

	informal_query := $iq$
		select 
			json_data->>'informal_name' 
		from tabletemp
	$iq$; 
	execute informal_query into informal_result;

	supersedes_query := $sq$
		select 
			json_data->'identifiers'->>'supersedes' 
		from tabletemp
	$sq$; 
	execute supersedes_query into supersedes_result;

	superseded_by_query := $sbq$
		select 
			json_data->'identifiers'->>'superseded_by' 
		from tabletemp
	$sbq$; 
	execute superseded_by_query into superseded_by_result;

	update 
		public.collections
	set
		collection_group_id = collection_group_result,
		formal_name = title_result,
		informal_name = informal_result,
		supersedes = supersedes_result,
		superseded_by = superseded_by_result
	where
		collection_id = new.collection_id;

	return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER collectionsUpdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.collections_trigger();



CREATE FUNCTION metadata.geom_trigger() RETURNS trigger AS $$
declare
	geom_query text;
	geom_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	geom_query := $jq$
		select 
			ST_MakeEnvelope(
				cast(json_data->'bounding_box'->>'west' as float),
				cast(json_data->'bounding_box'->>'south' as float),
				cast(json_data->'bounding_box'->>'east' as float),
				cast(json_data->'bounding_box'->>'north' as float),
				4326
			)		
		from tabletemp
	$jq$; 
	execute geom_query into geom_result;

	--Get the thing we're after
	new.geom := geom_result;
	return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER geomupdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.geom_trigger();

CREATE FUNCTION metadata.title_trigger() RETURNS trigger AS $$
declare
	json_path text;
	title_query text;
	title_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	title_query := $jq$
		select 
			json_data->>'title' 
		from tabletemp
	$jq$; 
	execute title_query into title_result;

	--Get the thing we're after
	new.title_search := to_tsvector('pg_catalog.english', title_result);
	return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER titleTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.title_trigger();

CREATE FUNCTION metadata.author_trigger() RETURNS trigger AS $$
declare
	json_path text;
	author_nulltest text;
	author_query text;
	author_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);

	select json_data #>> '{"authors"}' from tabletemp into author_nulltest;
	if author_nulltest is null then
		author_query := $nq$
			SELECT
				null as authors
		$nq$;
	else
		author_query := $jq$  
			SELECT  
				k.authors
			FROM (
				SELECT 
					string_agg(author, ';') as authors
				FROM (
					select 
						jsonb_array_elements(
							json_data #> 
								'{"authors"}'					
						) 
						#>> '{"person"}' 
					  as author from tabletemp
				) as a
			) k
		$jq$;
	end if;

	execute author_query into author_result;

	--Get the thing we're after
	new.author_search := to_tsvector('pg_catalog.english', author_result);
	return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER authorTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.author_trigger();

CREATE FUNCTION metadata.keyword_trigger() RETURNS trigger AS $$
declare
	json_path text;
	keyword_nulltest text;
	keyword_query text;
	keyword_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);

	select json_data #>> '{"keywords"}' from tabletemp into keyword_nulltest;
	if keyword_nulltest is null then
		keyword_query := $nq$
			SELECT
				null as keywords
		$nq$;
	else
		keyword_query := $jq$  
			SELECT  
				k.keywords
			FROM (
				SELECT 
					string_agg(keyword, ';') as keywords
				FROM (
					select  
						jsonb_array_elements(
							json_data #> 
								'{"keywords"}'					
						) 
						#>> '{"name"}' 
					  as keyword from tabletemp
				) as a
			) k
		$jq$;
	end if;
	
	execute keyword_query into keyword_result;

	--Get the thing we're after
	new.keyword_search := to_tsvector('pg_catalog.english', keyword_result);
  return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER keywordTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.keyword_trigger();

CREATE FUNCTION metadata.series_trigger() RETURNS trigger AS $$
declare
	json_path text;
	series_query text;
	series_result text;

begin
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);
	series_query := $jq$
		select
			json_data#>'{"series"}' as serial 
		from tabletemp
	$jq$;
/*
		SELECT  
			k.series
		FROM (
			SELECT 
				string_agg(serial, ';') as series
			FROM (
				select jsonb_array_elements_text($jq$ || json_path || $jq$ 
			) as a
		) k
	$jq$;
*/
	execute series_query into series_result;

	--Get the thing we're after
	new.series_search := to_tsvector('pg_catalog.english', series_result);
  return new;

end
$$ LANGUAGE plpgsql;

CREATE TRIGGER seriesTSVupdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.series_trigger();



