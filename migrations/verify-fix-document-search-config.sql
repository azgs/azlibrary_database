-- verify-fix-document-search-config.sql
--
-- One row per assertion from
-- openspec/changes/fix-document-search-config/specs/document-text-index/spec.md.
-- Every violation count must be zero. Assertion 6 is informational.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib \
--        -f migrations/verify-fix-document-search-config.sql
--
-- Assertion 5 is the one that matters most. It uses the pre-repair score
-- recorded in the backup table to confirm that no row below the threshold was
-- ever rewritten -- that is, that the repair never ran its destructive path on
-- a correctly indexed document. An earlier selector did exactly that.

\set ON_ERROR_STOP on
\pset pager off

WITH checks AS (
    SELECT 1 AS n,
           'no document still scores as simple-built (>= 0.25)' AS assertion,
           (SELECT count(*) FROM documents.documents
             WHERE documents.index_is_simple(text_search)) AS violations

    UNION ALL SELECT 2, 'no document has a null text_search',
           (SELECT count(*) FROM documents.documents WHERE text_search IS NULL)

    UNION ALL SELECT 3, 'every backed-up document still exists',
           (SELECT count(*) FROM documents.documents_backup_tsconfig b
             WHERE NOT EXISTS (SELECT 1 FROM documents.documents d
                                WHERE d.document_id = b.document_id))

    UNION ALL SELECT 4, 'every backed-up document was actually rewritten',
           (SELECT count(*) FROM documents.documents_backup_tsconfig b
              JOIN documents.documents d USING (document_id)
             WHERE d.text_search IS NOT DISTINCT FROM b.text_search)

    UNION ALL SELECT 5, 'ANTI-DESTRUCTION: no row below the threshold was rewritten',
           (SELECT count(*) FROM documents.documents_backup_tsconfig b
             WHERE b.unstemmed_fraction IS NULL OR b.unstemmed_fraction < 0.25)

    UNION ALL SELECT 6, 'INFORMATIONAL: rows left in the 0.12-0.25 grey zone',
           (SELECT count(*) FROM documents.documents
             WHERE coalesce(documents.unstemmed_fraction(text_search), 0) >= 0.12
               AND coalesce(documents.unstemmed_fraction(text_search), 0) <  0.25)

    UNION ALL SELECT 7, 'repaired rows now score in the english range (< 0.12)',
           (SELECT count(*) FROM documents.documents_backup_tsconfig b
              JOIN documents.documents d USING (document_id)
             WHERE coalesce(documents.unstemmed_fraction(d.text_search), 0) >= 0.12)

    UNION ALL SELECT 8, 'a repaired document is reachable by an inflected search',
           (SELECT count(*) FROM documents.documents_backup_tsconfig b
              JOIN documents.documents d USING (document_id)
             WHERE b.text_search @@ to_tsquery('pg_catalog.simple','geological')
               AND NOT (d.text_search @@ plainto_tsquery('pg_catalog.english','geology')))
)
SELECT n, assertion, violations,
       CASE WHEN n = 6 THEN 'INFO'
            WHEN violations = 0 THEN 'PASS' ELSE 'FAIL' END AS status
  FROM checks ORDER BY n;
