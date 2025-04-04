update
	metadata.azgs
set
	json_data = jsonb_set(
					json_data, 
					'{authors}',
					'[]', 
					true
				) - 'author'
where
	json_data->'identifiers'->>'perm_id' = 'APIX-1564000431079-291'
returning
	json_data;	

update
	metadata.azgs
set
	json_data = jsonb_set(
					json_data, 
					'{license}',
					'{}', 
					true
				) - 'author'
where
	json_data->'identifiers'->>'perm_id' = 'APIX-1564000431079-291'
returning
	json_data;
	

update
	metadata.azgs
set
	json_data = jsonb_set(
					json_data, 
					'{keywords}',
					'[]', 
					true
				) - 'author'
where
	json_data->'identifiers'->>'perm_id' = 'APIX-1564000431079-291'
returning
	json_data;