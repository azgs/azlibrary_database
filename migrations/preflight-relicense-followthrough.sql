-- preflight-relicense-followthrough.sql
--
-- READ-ONLY. Reports how many records still assert a licence other than
-- CC BY-SA 4.0, and which values they assert. Writes nothing and fires no
-- trigger. Run this against a database immediately before repairing it.
--
-- Usage:
--   psql -h <host> -U <user> -d azlibrary -f migrations/preflight-relicense-followthrough.sql
--
-- normalize-metadata-json relicensed every row on 12 November 2026 but left
-- three ingest tools stamping the superseded licence onto new records. This
-- reports what they wrote. The count is not known in advance: read it before
-- running the repair, and before writing any figure into a runbook.

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo '=== 1. Scale ==='

WITH cur AS (
    SELECT metadata_id,
           collection_id,
           json_data->'license'->>'type' AS t,
           json_data->'license'->>'url'  AS u
    FROM metadata.azgs
),
bad AS (
    SELECT * FROM cur
    WHERE t IS DISTINCT FROM 'CC BY-SA 4.0'
       OR u IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/'
),
checks AS (
    SELECT 1 AS n, 'rows in metadata.azgs' AS measure, count(*) AS value FROM cur
    UNION ALL SELECT 2, 'rows the repair would rewrite', count(*) FROM bad
    UNION ALL SELECT 3, 'rows asserting NonCommercial terms', count(*) FROM cur
        WHERE t ILIKE '%nc%' OR u ILIKE '%nc-sa%'
    UNION ALL SELECT 4, 'rows with no licence at all', count(*) FROM cur
        WHERE t IS NULL AND u IS NULL
    UNION ALL SELECT 5, 'rows with a blank licence', count(*) FROM cur
        WHERE btrim(coalesce(t,'')) = '' AND btrim(coalesce(u,'')) = ''
           AND NOT (t IS NULL AND u IS NULL)
    UNION ALL SELECT 6, 'rows where type and url disagree', count(*) FROM cur
        WHERE (t = 'CC BY-SA 4.0') <> (u = 'https://creativecommons.org/licenses/by-sa/4.0/')
)
SELECT n, measure, value FROM checks ORDER BY n;

\echo ''
\echo '=== 2. What the affected rows actually assert ==='

SELECT coalesce(json_data->'license'->>'type', '(null)') AS license_type,
       coalesce(json_data->'license'->>'url',  '(null)') AS license_url,
       count(*)                                          AS rows,
       min(collection_id)                                AS first_collection,
       max(collection_id)                                AS last_collection
FROM metadata.azgs
GROUP BY 1, 2
ORDER BY rows DESC;

\echo ''
\echo '=== 3. The affected collections, if few enough to read ==='

SELECT collection_id,
       json_data->'license'->>'type' AS license_type
FROM metadata.azgs
WHERE json_data->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'
   OR json_data->'license'->>'url'  IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/'
ORDER BY collection_id
LIMIT 100;

\echo ''
\echo 'If section 3 returned 100 rows the list is truncated; use section 1 for the count.'
\echo ''
