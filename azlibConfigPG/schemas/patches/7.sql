update public.version set version=7;

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
