-- verify-fix-bounding-box-geometries.sql
--
-- One row per assertion from
-- openspec/changes/fix-bounding-box-geometries/specs/collection-geometry/spec.md.
-- Every CHECK row must report 0 violations. INFO rows carry counts that
-- differ legitimately between devazlib and azlibrary.
--
-- Ends with the quarantine report: the records that remain implausible and
-- need a curator, which the migration deliberately left alone.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib \
--        -f migrations/verify-fix-bounding-box-geometries.sql

\set ON_ERROR_STOP on
\pset pager off

WITH
b AS (
    SELECT a.metadata_id,
           a.collection_id,
           a.geom,
           (a.json_data->'bounding_box'->>'north')::numeric AS n,
           (a.json_data->'bounding_box'->>'south')::numeric AS s,
           (a.json_data->'bounding_box'->>'east')::numeric  AS e,
           (a.json_data->'bounding_box'->>'west')::numeric  AS w
    FROM metadata.azgs a
    WHERE jsonb_typeof(a.json_data->'bounding_box'->'north') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'south') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'east')  = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'west')  = 'number'
),
checks AS (
    SELECT 1 AS n, 'CHECK' AS kind,
           'every row has four numeric bounding box coordinates' AS assertion,
           (SELECT count(*) FROM metadata.azgs) - (SELECT count(*) FROM b) AS value

    -- Each repair rule is exhausted: nothing is left that it would select.
    UNION ALL SELECT 2, 'CHECK', 'Rule A exhausted: no row has both longitudes positive with a negation landing in Arizona',
        (SELECT count(*) FROM b
         WHERE e > 0 AND w > 0 AND abs(n) <= 90 AND abs(s) <= 90
           AND ST_Intersects(
                   ST_MakeEnvelope(-greatest(abs(e),abs(w)), least(s,n),
                                   -least(abs(e),abs(w)),    greatest(s,n), 4326),
                   ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 3, 'CHECK', 'Rule B exhausted: no row stores west greater than east',
        (SELECT count(*) FROM b WHERE w > e)

    UNION ALL SELECT 4, 'CHECK', 'Rule D exhausted: no row has west positive with east negative',
        (SELECT count(*) FROM b
         WHERE w > 0 AND e < 0 AND abs(n) <= 90 AND abs(s) <= 90
           AND ST_Intersects(
                   ST_MakeEnvelope(least(-w,e), least(s,n), greatest(-w,e), greatest(s,n), 4326),
                   ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 5, 'CHECK', 'Rule E exhausted: no row stores south greater than north',
        (SELECT count(*) FROM b WHERE s > n)

    UNION ALL SELECT 6, 'CHECK', 'collection 27608, if present, holds the Arizona state extent',
        (SELECT count(*) FROM b WHERE collection_id = 27608
         AND NOT (n =   37.23233485 AND s =   31.13035647
              AND e = -108.8724393  AND w = -115.0247831))

    -- The central assertion: the two representations of a footprint agree.
    -- geom is written only by metadata.geom_trigger(), so a mismatch means
    -- either the trigger did not fire or something wrote geom directly.
    UNION ALL SELECT 7, 'CHECK', 'geom equals the envelope of the stored bounding box, on every row',
        (SELECT count(*) FROM b
         WHERE geom IS NULL
            OR NOT ST_Equals(geom, ST_MakeEnvelope(w, s, e, n, 4326)))

    UNION ALL SELECT 8, 'CHECK', 'every unrepaired row kept the geometry it had before the migration',
        (SELECT count(*) FROM metadata.azgs_backup_geometry bk
         JOIN metadata.azgs a USING (collection_id)
         WHERE bk.will_repair = false
           AND NOT ST_Equals(a.geom, bk.geom))

    -- Not "geom changed": Rules B and E exchange two endpoints, which yields
    -- the same rectangle wound the other way, so those repairs legitimately
    -- leave geom spatially equal. What must be true of every repaired row is
    -- that its stored JSON changed. Info row 14 counts the transpositions.
    UNION ALL SELECT 9, 'CHECK', 'every repaired row has json_data differing from its pre-image',
        (SELECT count(*) FROM metadata.azgs_backup_geometry bk
         JOIN metadata.azgs a USING (collection_id)
         WHERE bk.will_repair = true
           AND a.json_data IS NOT DISTINCT FROM bk.json_data)

    UNION ALL SELECT 10, 'CHECK', 'every repaired row has its pre-migration json_data kept for rollback',
        (SELECT count(*) FROM metadata.azgs_backup_geometry
         WHERE will_repair = true AND json_data IS NULL)

    -- Tests that nothing was LOST, not that the counts match. Records created
    -- while the migration runs are legitimate; info row 13 reports them.
    UNION ALL SELECT 11, 'CHECK', 'no backed-up row is missing (nothing deleted)',
        (SELECT count(*) FROM metadata.azgs_backup_geometry bk
         LEFT JOIN metadata.azgs a USING (collection_id)
         WHERE a.collection_id IS NULL)

    UNION ALL SELECT 12, 'INFO', 'rows repaired',
        (SELECT count(*) FROM metadata.azgs_backup_geometry WHERE will_repair)

    UNION ALL SELECT 13, 'INFO', 'rows created during the run (not in backup)',
        (SELECT count(*) FROM metadata.azgs a
         LEFT JOIN metadata.azgs_backup_geometry bk USING (collection_id)
         WHERE bk.collection_id IS NULL)

    UNION ALL SELECT 14, 'INFO', 'repaired rows that were pure transpositions (geometry unmoved)',
        (SELECT count(*) FROM metadata.azgs_backup_geometry bk
         JOIN metadata.azgs a USING (collection_id)
         WHERE bk.will_repair = true AND ST_Equals(a.geom, bk.geom))

    UNION ALL SELECT 15, 'INFO', 'rows whose box still does not intersect Arizona',
        (SELECT count(*) FROM b
         WHERE NOT ST_Intersects(
                 ST_MakeEnvelope(least(w,e), least(s,n), greatest(w,e), greatest(s,n), 4326),
                 ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 16, 'INFO', 'total rows in metadata.azgs',
        (SELECT count(*) FROM metadata.azgs)
)
SELECT n, kind, assertion, value,
       CASE WHEN kind = 'INFO' THEN 'INFO'
            WHEN value = 0 THEN 'PASS'
            ELSE 'FAIL' END AS result
FROM checks ORDER BY n;

-- ---------------------------------------------------------------------------
-- Quarantine report. These records remain implausible, and their correct
-- values cannot be derived from what is stored, so the migration left them
-- alone. They need a curator, not a rule.
-- ---------------------------------------------------------------------------
\echo ''
\echo 'QUARANTINE REPORT -- records left unrepaired, for curatorial follow-up'

SELECT collection_id,
       left(coalesce(nullif(series, ''), '(none)'), 32) AS series,
       left(title, 44) AS title,
       n AS north, s AS south, e AS east, w AS west,
       reason
FROM (
    SELECT a.collection_id,
           a.json_data->>'series' AS series,
           a.json_data->>'title'  AS title,
           (a.json_data->'bounding_box'->>'north')::numeric AS n,
           (a.json_data->'bounding_box'->>'south')::numeric AS s,
           (a.json_data->'bounding_box'->>'east')::numeric  AS e,
           (a.json_data->'bounding_box'->>'west')::numeric  AS w,
           CASE
               WHEN abs((a.json_data->'bounding_box'->>'north')::numeric) > 90
                 OR abs((a.json_data->'bounding_box'->>'south')::numeric) > 90
                   THEN 'latitude outside +/-90; true bound not recoverable'
               WHEN a.json_data->>'series' = 'DGM-asdf'
                   THEN 'test record'
               WHEN a.collection_id IN (15738, 16615)
                   THEN 'statewide Arizona map placed in the Pacific Ocean'
               WHEN (a.json_data->'bounding_box'->>'west')::numeric BETWEEN -115.5 AND -108.5
                AND (a.json_data->'bounding_box'->>'east')::numeric BETWEEN -115.5 AND -108.5
                AND ((a.json_data->'bounding_box'->>'south')::numeric < 25
                  OR (a.json_data->'bounding_box'->>'north')::numeric > 45)
                   THEN 'Arizona longitude with implausible latitude'
               WHEN a.collection_id = 8962
                   THEN 'degenerate point about one degree south of the border'
           END AS reason
    FROM metadata.azgs a
    WHERE jsonb_typeof(a.json_data->'bounding_box'->'north') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'south') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'east')  = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'west')  = 'number'
) q
WHERE reason IS NOT NULL
ORDER BY reason, collection_id;
