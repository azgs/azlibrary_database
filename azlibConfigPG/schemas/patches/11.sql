update public.version set version=11;

-- To correct bad characters in collection_group 5
update 
	public.collection_groups 
set 
	collection_group_name = 'Troy L. Péwé Environmental Geology Collection'
where 
	collection_group_id = 5;

-- Also correct any bad metadata that has resulted from this error
update 
	metadata.azgs
set
	json_data = jsonb_set(
		json_data,
		'{collection_group, name}',
		'"Troy L. Péwé Environmental Geology Collection"',
		false
	)
where
	json_data->'collection_group'->'name' = '"Troy L. PŽwŽ Environmental Geology Collection"';



