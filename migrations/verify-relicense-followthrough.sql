-- verify-relicense-followthrough.sql
--
-- One row per assertion from
-- openspec/changes/relicense-followthrough/specs/metadata-json-format/spec.md.
-- Every violation count must be zero.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -f migrations/verify-relicense-followthrough.sql

\set ON_ERROR_STOP on
\pset pager off

WITH checks AS (
    SELECT 1 AS n, 'every row has license.type = CC BY-SA 4.0' AS assertion, count(*) AS violations
    FROM metadata.azgs
    WHERE json_data->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'

    UNION ALL SELECT 2, 'every row has the matching license.url', count(*)
    FROM metadata.azgs
    WHERE json_data->'license'->>'url' IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/'

    UNION ALL SELECT 3, 'no license.type retains NonCommercial terms', count(*)
    FROM metadata.azgs
    WHERE json_data->'license'->>'type' ILIKE '%nc%'

    UNION ALL SELECT 4, 'no license.url retains NonCommercial terms', count(*)
    FROM metadata.azgs
    WHERE json_data->'license'->>'url' ILIKE '%nc-sa%'

    UNION ALL SELECT 5, 'license is a JSON object on every row', count(*)
    FROM metadata.azgs
    WHERE jsonb_typeof(json_data->'license') IS DISTINCT FROM 'object'

    UNION ALL SELECT 6, 'the enforcing constraint exists', count(*)
    FROM (
        SELECT 1
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'azgs_license_current'
              AND conrelid = 'metadata.azgs'::regclass
        )
    ) t
)
SELECT n,
       assertion,
       violations,
       CASE WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks ORDER BY n;

\echo ''
\echo 'Assertion 6 fails if the check constraint was not applied. That task is'
\echo 'separable (see design.md); if it was deliberately dropped, expect it to'
\echo 'fail and ignore it.'
\echo ''
