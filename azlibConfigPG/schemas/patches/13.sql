CREATE TABLE IF NOT EXISTS public.lineage (
	lineage_id serial PRIMARY KEY,
	collection text REFERENCES public.collections(perm_id), 
	supersedes text unique references public.collections(perm_id)
	UNIQUE (collection, supersedes)
);

INSERT INTO public.lineage (collection, supersedes)
    SELECT perm_id, supersedes FROM public.collections
    WHERE supersedes IS NOT NULL;

ALTER TABLE public.collections
    DROP COLUMN supersedes;

ALTER TABLE public.collections
    DROP COLUMN superseded_by;

CREATE OR REPLACE FUNCTION metadata.collections_trigger() RETURNS trigger AS $$
declare
	json_path text;
	collection_group_query text;
	collection_group_result integer;
	title_query text;
	title_result text;
	informal_query text;
	informal_result text;
	--supersedes_query text;
	--supersedes_result text;
	--superseded_by_query text;
	--superseded_by_result text;
	private_query text;
	private_result boolean;

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

	--supersedes_query := $sq$
	--	select 
	--		--json_data->'identifiers'->'supersedes' 
	--		json_data->'identifiers'->>'perm_id' as collection,
	--		jsonb_array_elements_text(json_data->'identifiers'->'supersedes') as supersedes
	--	from tabletemp
	--$sq$; 
	--execute supersedes_query into supersedes_result;

	--superseded_by_query := $sbq$
	--	select 
	--		json_data->'identifiers'->>'superseded_by' 
	--	from tabletemp
	--$sbq$; 
	--execute superseded_by_query into superseded_by_result;

	private_query := $pq$
		select 
			cast(json_data->>'private' as boolean) 
		from tabletemp
	$pq$; 
	execute private_query into private_result;

	update 
		public.collections
	set
		collection_group_id = collection_group_result,
		formal_name = title_result,
		informal_name = informal_result,
		--supersedes = supersedes_result,
		--superseded_by = superseded_by_result,
		private = private_result
	where
		collection_id = new.collection_id;

	insert into
		public.lineage (collection, supersedes)
		select 
			json_data->'identifiers'->>'perm_id' as collection,
			jsonb_array_elements_text(json_data->'identifiers'->'supersedes') as supersedes
		from tabletemp;

	return new;
end
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER collectionsUpdate BEFORE INSERT OR UPDATE
    ON metadata.azgs FOR EACH ROW EXECUTE PROCEDURE metadata.collections_trigger();

/*
--This updates the metadata so supersedes is an array. Only run this after trigger 
--is updated. 
update 
    metadata.azgs
set
	json_data =
	jsonb_set(
		json_data,
		'{identifiers,supersedes}',
        jsonb_build_array(json_data->'identifiers'->>'supersedes'),
        false)
where
	json_data->'identifiers'->'supersedes' is not null

--This updates the metadata so superseded_by is an array. Only run this after trigger 
--is updated. 
update 
    metadata.azgs
set
	json_data =
	jsonb_set(
		json_data,
		'{identifiers,superseded_by}',
        jsonb_build_array(json_data->'identifiers'->>'superseded_by'),
        false)
where
	json_data->'identifiers'->'superseded_by' is not null


*/

