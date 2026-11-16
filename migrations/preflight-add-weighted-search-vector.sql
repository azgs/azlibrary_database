-- preflight-add-weighted-search-vector.sql
--
-- READ-ONLY. Reports the environment facts add-weighted-search-vector.sql
-- depends on, and computes the proposed vector as a pure expression over every
-- row without writing anything or firing a single trigger. Run this against a
-- database immediately before migrating it.
--
-- Usage:
--   psql -h <host> -U <user> -d azlibrary \
--        -f migrations/preflight-add-weighted-search-vector.sql
--
-- Every row marked CHECK must report PASS. Rows marked INFO are measurements,
-- including the ones the proposal and design leave unfilled: server version,
-- text search configuration, table size and abstract coverage.
--
-- Keep in step with add-weighted-search-vector.sql: the vector expression in
-- the `v` CTE below is the body of metadata.search_vector() inlined, so that
-- this script needs no function to exist yet.

\set ON_ERROR_STOP on
\pset pager off

WITH v AS (
    SELECT a.metadata_id,
           a.json_data AS d,
           setweight(to_tsvector('pg_catalog.english',
               coalesce(a.json_data->>'title', '')), 'A')
        || setweight(to_tsvector('pg_catalog.english',
               coalesce(kw.names, '')), 'B')
        || setweight(to_tsvector('pg_catalog.english',
               concat_ws(' ', au.people, a.json_data->>'series')), 'C')
        || setweight(to_tsvector('pg_catalog.english',
               coalesce(a.json_data->>'abstract', '')), 'D') AS tsv
      FROM metadata.azgs a
      CROSS JOIN LATERAL (
          SELECT string_agg(e.x->>'name', ' ' ORDER BY e.ord) AS names
            FROM jsonb_array_elements(
                     CASE WHEN jsonb_typeof(a.json_data->'keywords') = 'array'
                          THEN a.json_data->'keywords' ELSE '[]'::jsonb END
                 ) WITH ORDINALITY AS e(x, ord)
      ) kw
      CROSS JOIN LATERAL (
          SELECT string_agg(e.x->>'person', ' ' ORDER BY e.ord) AS people
            FROM jsonb_array_elements(
                     CASE WHEN jsonb_typeof(a.json_data->'authors') = 'array'
                          THEN a.json_data->'authors' ELSE '[]'::jsonb END
                 ) WITH ORDINALITY AS e(x, ord)
      ) au
),
col AS (
    SELECT is_generated
      FROM information_schema.columns
     WHERE table_schema = 'metadata'
       AND table_name   = 'azgs'
       AND column_name  = 'kitchensink_search'
),
checks AS (
    SELECT 1 AS n, 'CHECK' AS kind,
           'PostgreSQL is 12 or later (generated columns)' AS item,
           current_setting('server_version') AS value,
           CASE WHEN current_setting('server_version_num')::int >= 120000
                THEN 'PASS' ELSE 'FAIL' END AS status

    UNION ALL SELECT 2, 'INFO',
           'default_text_search_config (documents.text_search is built with the server default; the API queries it as english)',
           current_setting('default_text_search_config'), '-'

    UNION ALL SELECT 3, 'INFO', 'database', current_database(), '-'

    UNION ALL SELECT 4, 'INFO', 'rows in metadata.azgs',
           (SELECT count(*)::text FROM metadata.azgs), '-'

    UNION ALL SELECT 5, 'INFO', 'metadata.azgs total size (this is what gets rewritten)',
           pg_size_pretty(pg_total_relation_size('metadata.azgs')), '-'

    UNION ALL SELECT 6, 'CHECK',
           'kitchensink_search column state (expected: NEVER or absent)',
           coalesce((SELECT is_generated FROM col), 'absent'),
           CASE WHEN (SELECT is_generated FROM col) IS DISTINCT FROM 'ALWAYS'
                THEN 'PASS' ELSE 'FAIL -- already generated; migration is a no-op' END

    UNION ALL SELECT 7, 'CHECK',
           'rows where kitchensink_search already holds a value (expected: 0)',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE kitchensink_search IS NOT NULL
               AND kitchensink_search <> ''::tsvector),
           CASE WHEN (SELECT count(*) FROM metadata.azgs
                       WHERE kitchensink_search IS NOT NULL
                         AND kitchensink_search <> ''::tsvector) = 0
                THEN 'PASS' ELSE 'FAIL -- migration would discard data' END

    -- Field coverage. These are the numbers the proposal leaves unmeasured.
    UNION ALL SELECT 8, 'INFO', 'rows with a non-blank title',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE btrim(coalesce(json_data->>'title', '')) <> ''), '-'

    UNION ALL SELECT 9, 'INFO', 'rows with at least one keyword',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE jsonb_typeof(json_data->'keywords') = 'array'
               AND jsonb_array_length(json_data->'keywords') > 0), '-'

    UNION ALL SELECT 10, 'INFO', 'rows with at least one author',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE jsonb_typeof(json_data->'authors') = 'array'
               AND jsonb_array_length(json_data->'authors') > 0), '-'

    UNION ALL SELECT 11, 'INFO', 'rows with a non-blank series',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE btrim(coalesce(json_data->>'series', '')) <> ''), '-'

    UNION ALL SELECT 12, 'INFO',
           'rows with a non-blank abstract (newly searchable -- indexed nowhere today)',
           (SELECT count(*)::text FROM metadata.azgs
             WHERE btrim(coalesce(json_data->>'abstract', '')) <> ''), '-'

    -- Properties of the computed vector.
    UNION ALL SELECT 13, 'CHECK',
           'computed vector is never NULL',
           (SELECT count(*)::text FROM v WHERE tsv IS NULL),
           CASE WHEN (SELECT count(*) FROM v WHERE tsv IS NULL) = 0
                THEN 'PASS' ELSE 'FAIL' END

    UNION ALL SELECT 14, 'INFO',
           'rows whose computed vector is empty (no indexable text anywhere)',
           (SELECT count(*)::text FROM v WHERE tsv = ''::tsvector), '-'

    UNION ALL SELECT 15, 'INFO', 'lexemes per vector: min / avg / max',
           (SELECT min(length(tsv))::text || ' / ' ||
                   round(avg(length(tsv)), 1)::text || ' / ' ||
                   max(length(tsv))::text FROM v), '-'

    UNION ALL SELECT 16, 'INFO',
           'rows gaining at least one lexeme that exists in no current per-field vector',
           (SELECT count(*)::text FROM metadata.azgs a
             JOIN v ON v.metadata_id = a.metadata_id
            WHERE EXISTS (
                SELECT 1 FROM unnest(v.tsv) nv
                 WHERE NOT EXISTS (
                     SELECT 1 FROM unnest(
                         coalesce(a.title_search,  ''::tsvector) ||
                         coalesce(a.keyword_search,''::tsvector) ||
                         coalesce(a.author_search, ''::tsvector) ||
                         coalesce(a.series_search, ''::tsvector)) ov
                      WHERE ov.lexeme = nv.lexeme))), '-'
)
SELECT n, kind, item, value, status FROM checks ORDER BY n;
