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


--To get rid of useless null UA Library links
with 
	null_links as (
		select
			s.metadata_id,
			s.index
		from (
			select
				m.metadata_id,
				l.value,
				l.ordinality-1 as index
			from
				metadata.azgs m,
				jsonb_array_elements(m.json_data->'links') with ordinality l 				
		) s
		where
			s.value@>'{"url":null}'
	)

update 
	metadata.azgs m
set 
	json_data =  jsonb_set(
		json_data, 
		'{links}', 
		(json_data->'links') - n.index::integer,
		false
       )
from
	null_links n
where 
	m.metadata_id = n.metadata_id;
