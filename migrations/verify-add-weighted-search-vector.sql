-- verify-add-weighted-search-vector.sql
--
-- One row per assertion from
-- openspec/changes/add-weighted-search-vector/specs/metadata-search-index/spec.md.
-- Every violation count must be zero.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib \
--        -f migrations/verify-add-weighted-search-vector.sql
--
-- Assertion 4 is also the staleness detector described in the migration
-- header: it recomputes metadata.search_vector() over every row and compares
-- against the stored value. A non-zero count there means the function was
-- changed after the column was built, and the column needs rebuilding.
--
-- Two spec scenarios are NOT checked here, because they are structural rather
-- than observable after the fact: "per-field vectors are byte-for-byte what
-- they were" and "json_data and geom are unchanged". The migration issues no
-- UPDATE against metadata.azgs and alters no trigger, so neither can change;
-- assertion 8 confirms the triggers are all still attached.

\set ON_ERROR_STOP on
\pset pager off

WITH
titled AS (
    SELECT metadata_id, kitchensink_search
      FROM metadata.azgs
     WHERE to_tsvector('pg_catalog.english',
               coalesce(json_data->>'title', '')) <> ''::tsvector
),
keyworded AS (
    SELECT a.metadata_id, a.kitchensink_search
      FROM metadata.azgs a
     WHERE jsonb_typeof(a.json_data->'keywords') = 'array'
       AND to_tsvector('pg_catalog.english', coalesce(
               (SELECT string_agg(e.x->>'name', ' ' ORDER BY e.ord)
                  FROM jsonb_array_elements(a.json_data->'keywords')
                       WITH ORDINALITY AS e(x, ord)), '')) <> ''::tsvector
),
checks AS (
    SELECT 1 AS n,
           'kitchensink_search is a generated column' AS assertion,
           (SELECT count(*) FROM (SELECT 1) s
             WHERE NOT EXISTS (
                 SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'metadata'
                    AND table_name   = 'azgs'
                    AND column_name  = 'kitchensink_search'
                    AND is_generated = 'ALWAYS')) AS violations

    UNION ALL SELECT 2, 'a GIN index exists on kitchensink_search',
           (SELECT count(*) FROM (SELECT 1) s
             WHERE NOT EXISTS (
                 SELECT 1
                   FROM pg_index i
                   JOIN pg_class  c ON c.oid = i.indexrelid
                   JOIN pg_class  t ON t.oid = i.indrelid
                   JOIN pg_namespace n ON n.oid = t.relnamespace
                   JOIN pg_am     am ON am.oid = c.relam
                   JOIN pg_attribute a ON a.attrelid = t.oid
                                      AND a.attnum = ANY (i.indkey)
                  WHERE n.nspname = 'metadata'
                    AND t.relname = 'azgs'
                    AND a.attname = 'kitchensink_search'
                    AND am.amname = 'gin'))

    UNION ALL SELECT 3, 'kitchensink_search is never null',
           (SELECT count(*) FROM metadata.azgs WHERE kitchensink_search IS NULL)

    UNION ALL SELECT 4, 'stored vector matches a fresh computation (staleness detector)',
           (SELECT count(*) FROM metadata.azgs
             WHERE kitchensink_search
                   IS DISTINCT FROM metadata.search_vector(json_data))

    UNION ALL SELECT 5, 'rows with an indexable title carry an A-weighted lexeme',
           (SELECT count(*) FROM titled
             WHERE kitchensink_search::text !~ '[:,][0-9]+A')

    UNION ALL SELECT 6, 'rows with an indexable keyword carry a B-weighted lexeme',
           (SELECT count(*) FROM keyworded
             WHERE kitchensink_search::text !~ '[:,][0-9]+B')

    UNION ALL SELECT 7, 'every abstract lexeme appears in the vector',
           (SELECT count(*) FROM metadata.azgs a
             WHERE EXISTS (
                 SELECT 1
                   FROM unnest(to_tsvector('pg_catalog.english',
                            coalesce(a.json_data->>'abstract', ''))) ab
                  WHERE NOT EXISTS (
                      SELECT 1 FROM unnest(a.kitchensink_search) k
                       WHERE k.lexeme = ab.lexeme)))

    UNION ALL SELECT 8, 'all six pre-existing row triggers are still attached',
           (SELECT abs(count(*) - 6)
              FROM pg_trigger tg
              JOIN pg_class c ON c.oid = tg.tgrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'metadata'
               AND c.relname = 'azgs'
               AND NOT tg.tgisinternal)

    UNION ALL SELECT 9, 'per-field vectors are still populated where their source is',
           (SELECT count(*) FROM metadata.azgs
             WHERE to_tsvector('pg_catalog.english',
                       coalesce(json_data->>'title', '')) <> ''::tsvector
               AND (title_search IS NULL OR title_search = ''::tsvector))

    UNION ALL SELECT 10, 'metadata.search_vector is declared IMMUTABLE',
           (SELECT count(*) FROM (SELECT 1) s
             WHERE NOT EXISTS (
                 SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'metadata'
                    AND p.proname = 'search_vector'
                    AND p.provolatile = 'i'))
)
SELECT n,
       assertion,
       violations,
       CASE WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS status
  FROM checks
 ORDER BY n;
