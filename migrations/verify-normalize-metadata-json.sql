-- verify-normalize-metadata-json.sql
--
-- One row per assertion from
-- openspec/changes/normalize-metadata-json/specs/metadata-json-format/spec.md.
-- Every violation count must be zero.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -f migrations/verify-normalize-metadata-json.sql

\set ON_ERROR_STOP on
\pset pager off

WITH
kw AS (
    SELECT a.metadata_id, e.x
    FROM metadata.azgs a
    CROSS JOIN LATERAL jsonb_array_elements(a.json_data->'keywords') e(x)
    WHERE jsonb_typeof(a.json_data->'keywords') = 'array'
),
kw_dupes AS (
    SELECT metadata_id
    FROM kw
    GROUP BY metadata_id, x->>'name', x->>'type'
    HAVING count(*) > 1
),
lnk AS (
    SELECT a.metadata_id, e.x
    FROM metadata.azgs a
    CROSS JOIN LATERAL jsonb_array_elements(a.json_data->'links') e(x)
    WHERE jsonb_typeof(a.json_data->'links') = 'array'
),
checks AS (
    SELECT 1 AS n, 'bounding box coords are JSON numbers' AS assertion, count(*) AS violations
    FROM metadata.azgs, LATERAL (VALUES ('north'),('south'),('east'),('west')) AS t(k)
    WHERE jsonb_typeof(json_data->'bounding_box') = 'object'
      AND jsonb_typeof(json_data->'bounding_box'->t.k) IS DISTINCT FROM 'number'

    UNION ALL SELECT 2, 'year is a JSON number or null', count(*)
    FROM metadata.azgs
    WHERE jsonb_typeof(json_data->'year') NOT IN ('number','null')

    UNION ALL SELECT 3, 'journal is the empty object on every row', count(*)
    FROM metadata.azgs
    WHERE json_data->'journal'
          IS DISTINCT FROM '{"name": null, "publisher": null, "url": null}'::jsonb

    UNION ALL SELECT 4, 'keyword names are trimmed', count(*)
    FROM kw WHERE (x->>'name') <> btrim(x->>'name')

    UNION ALL SELECT 5, 'no blank keyword names', count(*)
    FROM kw WHERE btrim(x->>'name') = ''

    UNION ALL SELECT 6, 'keyword (name,type) unique within a record', count(*)
    FROM kw_dupes

    UNION ALL SELECT 7, 'keyword type vocabulary is place/theme/temporal', count(*)
    FROM kw WHERE x->>'type' NOT IN ('place','theme','temporal')

    UNION ALL SELECT 8, 'mine_data.collection is trimmed', count(*)
    FROM metadata.azgs
    WHERE jsonb_typeof(json_data->'mine_data'->'collection') = 'string'
      AND (json_data->'mine_data'->>'collection') <> btrim(json_data->'mine_data'->>'collection')

    UNION ALL SELECT 9, 'link names are canonical', count(*)
    FROM lnk WHERE x->>'name' NOT IN ('AZGS old','UA Library')

    UNION ALL SELECT 10, 'no misspelled author/informalname keys', count(*)
    FROM metadata.azgs
    WHERE json_data ? 'author' OR json_data ? 'informalname'

    UNION ALL SELECT 11, 'every row asserts CC BY-SA 4.0', count(*)
    FROM metadata.azgs
    WHERE json_data->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'
       OR json_data->'license'->>'url'  IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/'

    UNION ALL SELECT 12, 'no NonCommercial terms remain', count(*)
    FROM metadata.azgs
    WHERE (json_data->'license')::text ILIKE '%nc%'

    UNION ALL SELECT 13, 'geom unchanged vs backup', count(*)
    FROM metadata.azgs a
    JOIN metadata.azgs_backup_normalize b USING (collection_id)
    WHERE NOT (
        (a.geom IS NULL AND b.geom IS NULL)
        OR (a.geom IS NOT NULL AND b.geom IS NOT NULL AND ST_Equals(a.geom, b.geom))
    )

    UNION ALL SELECT 14, 'journal boilerplate preserved in abstract', count(*)
    FROM metadata.azgs_backup_normalize b
    JOIN metadata.azgs a USING (collection_id)
    WHERE jsonb_typeof(b.json_data->'journal') = 'string'
      AND position(btrim(b.json_data->>'journal') IN COALESCE(a.json_data->>'abstract','')) = 0

    UNION ALL SELECT 15, 'no abstract has duplicated boilerplate', count(*)
    FROM metadata.azgs
    WHERE (length(json_data->>'abstract')
           - length(replace(json_data->>'abstract', 'Please cite by using', ''))) / 20 > 1

    -- Tests that nothing was LOST, not that the counts match. Records created
    -- while the migration runs are legitimate and land in a later batch, so a
    -- count comparison false-alarms on them; check 17 reports them instead.
    UNION ALL SELECT 16, 'no backed-up row is missing (nothing deleted)', count(*)
    FROM metadata.azgs_backup_normalize b
    LEFT JOIN metadata.azgs a USING (collection_id)
    WHERE a.collection_id IS NULL

    UNION ALL SELECT 17, 'INFO: rows created during the run (not in backup)', count(*)
    FROM metadata.azgs a
    LEFT JOIN metadata.azgs_backup_normalize b USING (collection_id)
    WHERE b.collection_id IS NULL
)
SELECT n, assertion, violations,
       CASE WHEN n = 17 THEN 'INFO'
            WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks ORDER BY n;
