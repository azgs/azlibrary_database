-- preflight-fix-bounding-box-geometries.sql
--
-- READ-ONLY. Computes the repair that fix-bounding-box-geometries.sql would
-- apply and asserts the spec against the computed output, without writing
-- anything. Run this before the migration on each database.
--
-- See openspec/changes/fix-bounding-box-geometries/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib \
--        -f migrations/preflight-fix-bounding-box-geometries.sql
--
-- Every row marked CHECK must report 0 violations. INFO rows carry counts
-- that differ legitimately between devazlib and azlibrary.

\set ON_ERROR_STOP on
\pset pager off

-- The Arizona envelope: the state's extent padded by roughly half a degree.
-- Rule A's safety depends on it, so it is written out at each use rather than
-- hidden behind a name.

WITH
src AS (
    SELECT a.metadata_id,
           a.collection_id,
           a.json_data->>'series' AS series,
           a.json_data->>'title'  AS title,
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

-- Rule classification. The three rules are disjoint; check 10 proves it
-- rather than assuming it.
cls AS (
    SELECT src.*,
           -- Rule A: both longitudes stored as positive magnitudes, and
           -- negating both lands the box in Arizona. The second half is the
           -- guard that spares records genuinely in the eastern hemisphere.
           (e > 0 AND w > 0 AND abs(n) <= 90 AND abs(s) <= 90
            AND ST_Intersects(
                    ST_MakeEnvelope(-greatest(abs(e), abs(w)), least(s, n),
                                    -least(abs(e), abs(w)),    greatest(s, n), 4326),
                    ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326))) AS rule_a,
           -- Rule B: east and west transposed, both already negative. Both
           -- negative is required so that an extent legitimately crossing the
           -- antimeridian, where west > east is correct, is never touched.
           (w > e AND e < 0 AND w < 0) AS rule_b,
           -- Rule C: collection 27608, east and south transposed. Keyed on
           -- the stored values as well as the id, so that a re-run does not
           -- transpose them a second time and undo the repair.
           (collection_id = 27608
            AND n =   37.23233485 AND s = -108.8724393
            AND e =   31.13035647 AND w = -115.0247831) AS rule_c,
           -- Rule D: west alone stored as a positive magnitude. Rule A needs
           -- both longitudes positive, so it does not see this; the resulting
           -- envelope spans the globe and matches map searches everywhere.
           (w > 0 AND e < 0 AND abs(n) <= 90 AND abs(s) <= 90
            AND ST_Intersects(
                    ST_MakeEnvelope(least(-w, e), least(s, n),
                                    greatest(-w, e), greatest(s, n), 4326),
                    ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326))) AS rule_d,
           -- Rule E: north and south transposed. Unlike the longitude rules
           -- this needs no Arizona guard: a bounding box must have
           -- south <= north everywhere on earth, and there is no latitude
           -- equivalent of crossing the antimeridian.
           (s > n) AS rule_e
    FROM src
),

-- The corrected coordinates. Rules A and D compute both longitudes from the
-- magnitudes, so the pair comes out in ascending order whichever order it was
-- stored in. Rule E only touches the latitudes, so it composes with a
-- longitude rule rather than competing with it.
fx AS (
    SELECT cls.*,
           CASE WHEN rule_e THEN s ELSE n END AS n2,
           CASE WHEN rule_c THEN e
                WHEN rule_e THEN n
                ELSE s END AS s2,
           CASE WHEN rule_a THEN -least(abs(e), abs(w))
                WHEN rule_b THEN w
                WHEN rule_c THEN s
                WHEN rule_d THEN greatest(-w, e)
                ELSE e END AS e2,
           CASE WHEN rule_a THEN -greatest(abs(e), abs(w))
                WHEN rule_b THEN e
                WHEN rule_d THEN least(-w, e)
                ELSE w END AS w2
    FROM cls
),

sel AS (SELECT * FROM fx WHERE rule_a OR rule_b OR rule_c OR rule_d OR rule_e),

checks AS (
    SELECT 1 AS n, 'CHECK' AS kind,
           'every row has four numeric bounding box coordinates' AS assertion,
           (SELECT count(*) FROM metadata.azgs) - (SELECT count(*) FROM src) AS value

    UNION ALL SELECT 2, 'CHECK', 'Rule A selects 456 rows',
        (SELECT CASE WHEN count(*) = 456 THEN 0 ELSE count(*) END FROM fx WHERE rule_a)

    UNION ALL SELECT 3, 'CHECK', 'every Rule A row intersects Arizona after correction',
        (SELECT count(*) FROM fx WHERE rule_a
         AND NOT ST_Intersects(
                 ST_MakeEnvelope(least(w2,e2), least(s2,n2), greatest(w2,e2), greatest(s2,n2), 4326),
                 ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 4, 'CHECK', 'Rule A never touches a row with a negative west (antimeridian extents)',
        (SELECT count(*) FROM fx WHERE rule_a AND w <= 0)

    UNION ALL SELECT 5, 'CHECK', 'Rule A excludes the eastern-hemisphere USGIN records 28135 and 28139',
        (SELECT count(*) FROM fx WHERE rule_a AND collection_id IN (28135, 28139))

    UNION ALL SELECT 6, 'CHECK', 'Rule B selects 5 rows',
        (SELECT CASE WHEN count(*) = 5 THEN 0 ELSE count(*) END FROM fx WHERE rule_b)

    UNION ALL SELECT 7, 'CHECK', 'every Rule B row has both longitudes negative',
        (SELECT count(*) FROM fx WHERE rule_b AND NOT (e < 0 AND w < 0))

    UNION ALL SELECT 8, 'CHECK', 'Rule C selects no row other than collection 27608',
        (SELECT count(*) FROM fx WHERE rule_c AND collection_id <> 27608)

    UNION ALL SELECT 9, 'CHECK', 'Rule C correction yields the Arizona state extent',
        (SELECT count(*) FROM fx WHERE rule_c
         AND NOT (n2 =   37.23233485 AND s2 =   31.13035647
              AND e2 = -108.8724393  AND w2 = -115.0247831))

    UNION ALL SELECT 10, 'CHECK', 'every Rule D row has west positive and east negative',
        (SELECT count(*) FROM fx WHERE rule_d AND NOT (w > 0 AND e < 0))

    UNION ALL SELECT 11, 'CHECK', 'every Rule D row intersects Arizona after correction',
        (SELECT count(*) FROM fx WHERE rule_d
         AND NOT ST_Intersects(
                 ST_MakeEnvelope(least(w2,e2), least(s2,n2), greatest(w2,e2), greatest(s2,n2), 4326),
                 ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 12, 'CHECK', 'every Rule E row had south greater than north before correction',
        (SELECT count(*) FROM fx WHERE rule_e AND NOT (s > n))

    UNION ALL SELECT 13, 'CHECK', 'Rule E correction leaves south <= north',
        (SELECT count(*) FROM fx WHERE rule_e AND s2 > n2)

    -- The four longitude rules must be mutually exclusive, since each assigns
    -- east and west outright. Rule E only assigns the latitudes, so it is
    -- allowed to coexist with them -- but not with Rule C, which reassigns
    -- south from the stored east.
    UNION ALL SELECT 14, 'CHECK', 'the four longitude rules are pairwise disjoint',
        (SELECT count(*) FROM fx
         WHERE (rule_a AND rule_b) OR (rule_a AND rule_c) OR (rule_a AND rule_d)
            OR (rule_b AND rule_c) OR (rule_b AND rule_d) OR (rule_c AND rule_d))

    UNION ALL SELECT 15, 'CHECK', 'Rule E never coincides with Rule C',
        (SELECT count(*) FROM fx WHERE rule_c AND rule_e)

    UNION ALL SELECT 16, 'CHECK', 'every corrected row has west <= east',
        (SELECT count(*) FROM sel WHERE w2 > e2)

    UNION ALL SELECT 17, 'CHECK', 'every corrected row has south <= north',
        (SELECT count(*) FROM sel WHERE s2 > n2)

    UNION ALL SELECT 18, 'CHECK', 'every corrected row has latitudes within +/-90',
        (SELECT count(*) FROM sel WHERE abs(n2) > 90 OR abs(s2) > 90)

    UNION ALL SELECT 19, 'CHECK', 'every corrected row has longitudes within +/-180',
        (SELECT count(*) FROM sel WHERE abs(e2) > 180 OR abs(w2) > 180)

    UNION ALL SELECT 20, 'CHECK', 'every selected row actually changes',
        (SELECT count(*) FROM sel WHERE n2 = n AND s2 = s AND e2 = e AND w2 = w)

    UNION ALL SELECT 21, 'CHECK', 'no unselected row would change',
        (SELECT count(*) FROM fx WHERE NOT (rule_a OR rule_b OR rule_c OR rule_d OR rule_e)
         AND NOT (n2 = n AND s2 = s AND e2 = e AND w2 = w))

    UNION ALL SELECT 22, 'INFO', 'rows selected by Rule A (both longitudes sign-flipped)',
        (SELECT count(*) FROM fx WHERE rule_a)

    UNION ALL SELECT 23, 'INFO', 'rows selected by Rule B (east/west transposed)',
        (SELECT count(*) FROM fx WHERE rule_b)

    UNION ALL SELECT 24, 'INFO', 'rows selected by Rule C (east/south transposed)',
        (SELECT count(*) FROM fx WHERE rule_c)

    UNION ALL SELECT 25, 'INFO', 'rows selected by Rule D (west alone sign-flipped)',
        (SELECT count(*) FROM fx WHERE rule_d)

    UNION ALL SELECT 26, 'INFO', 'rows selected by Rule E (north/south transposed)',
        (SELECT count(*) FROM fx WHERE rule_e)

    UNION ALL SELECT 27, 'INFO', 'rows the migration will update',
        (SELECT count(*) FROM sel)

    UNION ALL SELECT 28, 'INFO', 'Rule A candidates excluded by the Arizona guard',
        (SELECT count(*) FROM fx WHERE e > 0 AND w > 0 AND NOT rule_a)

    UNION ALL SELECT 29, 'INFO', 'BEFORE: rows whose box does not intersect Arizona',
        (SELECT count(*) FROM fx
         WHERE NOT ST_Intersects(
                 ST_MakeEnvelope(least(w,e), least(s,n), greatest(w,e), greatest(s,n), 4326),
                 ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 30, 'INFO', 'AFTER: rows whose box would not intersect Arizona',
        (SELECT count(*) FROM fx
         WHERE NOT ST_Intersects(
                 ST_MakeEnvelope(least(w2,e2), least(s2,n2), greatest(w2,e2), greatest(s2,n2), 4326),
                 ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)))

    UNION ALL SELECT 31, 'INFO', 'total rows in metadata.azgs',
        (SELECT count(*) FROM metadata.azgs)
)
SELECT n, kind, assertion, value,
       CASE WHEN kind = 'INFO' THEN 'INFO'
            WHEN value = 0 THEN 'PASS'
            ELSE 'FAIL' END AS result
FROM checks ORDER BY n;
