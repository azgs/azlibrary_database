-- preflight-fix-document-search-config.sql
--
-- READ-ONLY. Reports the facts fix-document-search-config.sql depends on and
-- proves the repair on live data without writing anything.
--
-- Usage:
--   psql -h <host> -U <user> -d azlibrary \
--        -f migrations/preflight-fix-document-search-config.sql
--
-- Every CHECK row must report PASS. INFO rows are measurements.
--
-- The scoring expression in the `score` CTE below is the body of
-- documents.unstemmed_fraction() inlined, so this script needs no function to
-- exist yet. KEEP THE TWO IN STEP: if the threshold or the sampling changes in
-- the migration, change it here too, or the preflight will describe a
-- different set of rows than the one the migration touches.

\set ON_ERROR_STOP on
\pset pager off

WITH score AS (
    SELECT d.document_id, d.collection_id, d.text_search,
           (WITH samp AS (
                SELECT x.lexeme FROM unnest(d.text_search) x
                 WHERE x.lexeme ~ '^[a-z]{4,}$'
                 ORDER BY hashtext(x.lexeme) LIMIT 100
            )
            SELECT CASE WHEN count(*) < 30 THEN NULL
                        ELSE count(*) FILTER (
                                 WHERE to_tsvector('pg_catalog.english', lexeme)::text
                                       IS DISTINCT FROM '''' || lexeme || ''':1'
                             )::numeric / count(*)
                   END
              FROM samp) AS frac
      FROM documents.documents d
),
target AS (
    SELECT * FROM score WHERE coalesce(frac >= 0.25, false)
),
pos AS (
    SELECT t.document_id,
           (SELECT max(p.pos) FROM unnest(t.text_search) x,
                                   unnest(x.positions) p(pos)) AS max_position,
           (SELECT count(*) FROM unnest(t.text_search) x
             WHERE x.positions IS NULL OR cardinality(x.positions) = 0) AS unpositioned
      FROM target t
),
recon AS (
    SELECT t.document_id, t.text_search,
           (SELECT string_agg(x.lexeme, ' ' ORDER BY p.pos)
              FROM unnest(t.text_search) x, unnest(x.positions) p(pos)) AS txt
      FROM target t
),
checks AS (
    SELECT 1 AS n, 'INFO' AS kind, 'database' AS item,
           current_database() AS value, '-' AS status

    UNION ALL SELECT 2, 'INFO',
           'default_text_search_config (what the broken ingest picked up)',
           current_setting('default_text_search_config'), '-'

    UNION ALL SELECT 3, 'INFO', 'total documents',
           (SELECT count(*)::text FROM documents.documents), '-'

    UNION ALL SELECT 4, 'INFO',
           'EMPTY tsvector -- extraction produced nothing, unsearchable either way',
           (SELECT count(*)::text FROM documents.documents
             WHERE length(text_search) = 0), '-'

    UNION ALL SELECT 5, 'INFO', 'scorable (>= 30 word-like lexemes)',
           (SELECT count(*)::text FROM score WHERE frac IS NOT NULL), '-'

    UNION ALL SELECT 6, 'INFO', 'english-built (unstemmed fraction < 0.12)',
           (SELECT count(*)::text FROM score WHERE frac < 0.12), '-'

    UNION ALL SELECT 7, 'INFO',
           'GREY ZONE 0.12-0.25 -- deliberately NOT repaired',
           (SELECT count(*)::text FROM score
             WHERE frac >= 0.12 AND frac < 0.25), '-'

    UNION ALL SELECT 8, 'INFO', 'SIMPLE-BUILT (>= 0.25) -- the repair target',
           (SELECT count(*)::text FROM target), '-'

    UNION ALL SELECT 9, 'INFO', 'collections affected',
           (SELECT count(DISTINCT collection_id)::text FROM target), '-'

    UNION ALL SELECT 10, 'CHECK',
           'no targeted row scores in the english range (<0.25) -- anti-destruction',
           (SELECT count(*)::text FROM target WHERE frac < 0.25),
           CASE WHEN (SELECT count(*) FROM target WHERE frac < 0.25) = 0
                THEN 'PASS' ELSE 'FAIL -- selector would destroy correct rows' END

    UNION ALL SELECT 11, 'CHECK',
           'every targeted vector carries positions (reconstruction needs them)',
           (SELECT coalesce(sum(unpositioned), 0)::text FROM pos),
           CASE WHEN (SELECT coalesce(sum(unpositioned), 0) FROM pos) = 0
                THEN 'PASS' ELSE 'FAIL' END

    UNION ALL SELECT 12, 'CHECK',
           'reconstruction yields text for every targeted row',
           (SELECT count(*)::text FROM recon WHERE txt IS NULL),
           CASE WHEN (SELECT count(*) FROM recon WHERE txt IS NULL) = 0
                THEN 'PASS' ELSE 'FAIL' END

    UNION ALL SELECT 13, 'CHECK',
           'repair leaves every targeted row scoring english afterwards',
           (SELECT count(*)::text FROM recon r
             WHERE (WITH s2 AS (
                        SELECT x.lexeme
                          FROM unnest(to_tsvector('pg_catalog.english', r.txt)) x
                         WHERE x.lexeme ~ '^[a-z]{4,}$'
                         ORDER BY hashtext(x.lexeme) LIMIT 100)
                    SELECT count(*) FILTER (
                               WHERE to_tsvector('pg_catalog.english', lexeme)::text
                                     IS DISTINCT FROM '''' || lexeme || ''':1'
                           )::numeric / nullif(count(*), 0)
                      FROM s2) >= 0.25),
           CASE WHEN (SELECT count(*) FROM recon r
                       WHERE (WITH s2 AS (
                                  SELECT x.lexeme
                                    FROM unnest(to_tsvector('pg_catalog.english', r.txt)) x
                                   WHERE x.lexeme ~ '^[a-z]{4,}$'
                                   ORDER BY hashtext(x.lexeme) LIMIT 100)
                              SELECT count(*) FILTER (
                                         WHERE to_tsvector('pg_catalog.english', lexeme)::text
                                               IS DISTINCT FROM '''' || lexeme || ''':1'
                                     )::numeric / nullif(count(*), 0)
                                FROM s2) >= 0.25) = 0
                THEN 'PASS' ELSE 'FAIL -- repair would not converge' END

    UNION ALL SELECT 14, 'INFO',
           'word order fully recoverable (max position < 16383)',
           (SELECT count(*)::text FROM pos WHERE max_position < 16383), '-'

    UNION ALL SELECT 15, 'INFO',
           'at the 16383 cap -- tail order already lost, repair cannot restore it',
           (SELECT count(*)::text FROM pos WHERE max_position >= 16383), '-'

    UNION ALL SELECT 16, 'INFO',
           'targeted rows that become findable for one sample term ("geological")',
           (SELECT count(*)::text FROM recon r
             WHERE NOT (r.text_search @@ plainto_tsquery('pg_catalog.english','geological'))
               AND to_tsvector('pg_catalog.english', r.txt)
                   @@ plainto_tsquery('pg_catalog.english','geological')), '-'

    UNION ALL SELECT 17, 'INFO',
           'backup table from a previous run (absent on a first run)',
           CASE WHEN to_regclass('documents.documents_backup_tsconfig') IS NULL
                THEN 'absent -- this is a first run'
                ELSE 'present -- this is a re-run' END, '-'
)
SELECT n, kind, item, value, status FROM checks ORDER BY n;
