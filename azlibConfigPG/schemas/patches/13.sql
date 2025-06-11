--For testing
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Test Group 01 - DO NOT USE', 'This collection group is for testing only', 'TST1');
INSERT INTO public.collection_groups (collection_group_name, collection_group_desc, collection_group_abbrv) VALUES ('Test Group 2 - DO NOT USE', 'This collection group is for testing only', 'TST2');

CREATE TABLE if not exists lineage (
	lineage_id serial PRIMARY KEY,
	collection text REFERENCES collections(perm_id), 
	supersedes text references collections(perm_id),
	UNIQUE (collection, supersedes)
);

CREATE TABLE if not exists lineage_removed (
	lineage_id integer PRIMARY KEY,
	collection text REFERENCES collections(perm_id), 
	supersedes text references collections(perm_id),
	UNIQUE (collection, supersedes)
);

INSERT INTO public.lineage (collection, supersedes)
    SELECT perm_id, supersedes FROM public.collections
    WHERE supersedes IS NOT NULL;

ALTER TABLE public.collections
    DROP COLUMN supersedes;

ALTER TABLE public.collections
    DROP COLUMN superseded_by;



-- View to facilitate working with the lineage table
--NOTE: the coalesce and filter are to get sql nulls when there is nothing
create view
	public.collections_lineage_view
as
	select 
		c.*,
  		coalesce(json_agg(l1.collection) filter (where l1.collection is not null), null)::jsonb AS superseded_by, 
  		coalesce(json_agg(l2.supersedes) filter (where l2.supersedes is not null), null)::jsonb AS supersedes 
	from 
		public.collections c
		left join public.lineage l1 on l1.supersedes = c.perm_id
		left join public.lineage l2 on l2.collection = c.perm_id
	group by c.collection_id;



CREATE OR REPLACE FUNCTION metadata.collections_trigger() RETURNS trigger AS $$
declare
	json_path text;
	collection_group_query text;
	collection_group_result integer;
	title_query text;
	title_result text;
	informal_query text;
	informal_result text;
	private_query text;
	private_result boolean;
	perm_id_query text;
	perm_id_result jsonb;
	supersedes_query text;
	supersedes_result jsonb;
	deleted_supersedes_query text;
	deleted_supersedes_result jsonb;

begin
	------------------------------------------------------------------------------
	--Stash new json_data in a temp table
	--This approach feels janky, but it's the only way I've been able to query jsonb
	--in the "new" variable.
	drop table if exists tabletemp;
	CREATE TEMP TABLE tabletemp 
	( 
		json_data jsonb
	) on commit drop;
	insert into tabletemp values(new.json_data);

	-----------------------------------------------------------------------------
	--Gather all the data we need to do the work
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

	private_query := $pq$
		select 
			cast(json_data->>'private' as boolean) 
		from tabletemp
	$pq$; 
	execute private_query into private_result;

	perm_id_query := $peq$
		select 
			jsonb_build_array(json_data->'identifiers'->>'perm_id') 
		from tabletemp
	$peq$; 
	execute perm_id_query into perm_id_result;

	supersedes_query := $sq$
		select 
			json_data->'identifiers'->'supersedes' 
		from tabletemp
	$sq$; 
	execute supersedes_query into supersedes_result;

	deleted_supersedes_query := $dsq$
		select
			jsonb_agg(l.supersedes)
		from
			public.lineage l
			inner join tabletemp t on l.collection = t.json_data->'identifiers'->>'perm_id'
		where 
			--not l.supersedes <@ supersedes_result
			not t.json_data->'identifiers'->'supersedes' ? l.supersedes
	$dsq$; 
	execute deleted_supersedes_query into deleted_supersedes_result;

	-------------------------------------------------------------------------
	--Now do the real work

	--Update public.collections for this collection with from new json_data
	update 
		public.collections
	set
		collection_group_id = collection_group_result,
		formal_name = title_result,
		informal_name = informal_result,
		private = private_result
	where
		collection_id = new.collection_id;

	--Add new records to public.lineage if there are new supersedes
	insert into
		public.lineage (collection, supersedes)
		select 
			json_data->'identifiers'->>'perm_id' as collection,
			jsonb_array_elements_text(json_data->'identifiers'->'supersedes') as supersedes
		from tabletemp
    on conflict do nothing;

	--Remove records from public.lineage if any supersedes were removed
	with deleted_rows as (
		delete from 
			public.lineage l
		using tabletemp as t 
		where
			l.collection = t.json_data->'identifiers'->>'perm_id' and
			deleted_supersedes_result ? l.supersedes
		returning l.lineage_id, l.collection, l.supersedes
	)
	insert into 
		public.lineage_removed
			select * from deleted_rows;

	--If there are new supersedes, update superseded_by in those collections' metadata
	update	
		metadata.azgs
	set
		json_data = jsonb_set(json_data, '{identifiers, superseded_by}', coalesce(json_data->'identifiers'->'superseded_by', '[]') || perm_id_result, true)
	where
		json_data->'identifiers'->'perm_id' <@ supersedes_result and (
			json_data->'identifiers'->'superseded_by' is null or
			not json_data->'identifiers'->'superseded_by' @> perm_id_result
		);

	--If supersedes were removed, update superseded_by in those collections' metadata
	update	
		metadata.azgs
	set
		json_data = jsonb_set(json_data, '{identifiers, superseded_by}', coalesce(json_data->'identifiers'->'superseded_by', '[]') - (perm_id_result->>0), true)
	where
		json_data->'identifiers'->'perm_id' <@ deleted_supersedes_result;

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


--TODO: skip this with new trigger?
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