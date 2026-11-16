-- fix-document-search-config.sql
--
-- Repairs documents.documents.text_search rows indexed under the server's
-- default text search configuration ('simple') instead of English, by
-- reconstructing each document's word order from the positions stored in its
-- existing tsvector and re-tokenizing under 'pg_catalog.english'.
-- See openspec/changes/fix-document-search-config/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib \
--        -f migrations/fix-document-search-config.sql
--
-- Optional: -v batch_size=500 (default 500).
--
-- Run migrations/preflight-fix-document-search-config.sql first. It is
-- read-only and must report PASS on every CHECK row before this is run.
--
-- Idempotent: a repaired row scores below the threshold and no longer matches
-- the selector, so a second run changes nothing.
--
-- ---------------------------------------------------------------------------
-- HOW ROWS ARE SELECTED, AND WHY NOT BY STOPWORD
--
-- An earlier version of this script selected rows holding an English stopword
-- lexeme, reasoning that 'english' strips stopwords so a vector holding one
-- was not built with it. That is WRONG and it corrupted 6,637 rows on dev
-- before being rolled back. The stopword filter runs on the token BEFORE
-- stemming, so an ordinary word whose stem equals a stopword puts that
-- stopword into a perfectly correct English vector: "owned" -> own,
-- "mostly" -> most, "willing" -> will, "others" -> other. On dev, 'own'
-- appears in 3,152 of 11,007 definitively English-built documents.
--
-- The selector below instead asks whether a vector's lexemes are STEMS.
-- 'simple' stores raw words, so many of its lexemes change under stemming
-- ("geological" -> geolog). 'english' stores stems, which are fixed points.
-- Measured on dev against two hand-verified populations of 150 documents:
--
--   english-built:  max unstemmed fraction 0.073
--   simple-built:   min unstemmed fraction 0.134
--
-- The threshold is 0.25, well above that gap rather than inside it, because
-- the English stemmer is NOT idempotent: 'consider' stems to 'consid',
-- 'environment' to 'environ', 'geophys' to 'geophi'. A correct English vector
-- therefore always scores somewhat above zero, and a short, vocabulary-dense
-- one can score as high as 0.12 -- an adversarial test fixture reached 0.123.
-- A threshold inside the observed gap has no margin against that. At 0.25 the
-- margin is better than 2x, and it costs almost nothing: a corpus-wide scoring
-- on dev found 403 documents at or above 0.12 and 402 at or above 0.25.
-- Everything between 0.07 and 0.25 is treated as a grey zone and deliberately
-- NOT repaired.
-- ---------------------------------------------------------------------------
--
-- ONLY AFFECTED ROWS ARE TOUCHED, and that is a correctness constraint rather
-- than an optimisation. Reconstruction is faithful for a 'simple'-built vector,
-- whose lexemes are the original tokens, and destructive for an English-built
-- one, whose lexemes are already stems: of 200 sampled correct documents, 0
-- round-tripped unchanged. Do not widen the selector.
--
-- WHAT THIS CANNOT RECOVER: tsvector positions are capped at 16,383. Documents
-- longer than that lost their tail word order at ingest, and no repair short of
-- re-extraction restores it. Stemming is corrected for every repaired document;
-- phrase queries spanning a clamped tail stay as unreliable as they are today.

\set ON_ERROR_STOP on
\timing on

\if :{?batch_size}
\else
\set batch_size 500
\endif

SET azlib.target_db = :'target_db';

DO $guard$
DECLARE
    expected text := current_setting('azlib.target_db');
BEGIN
    IF current_database() <> expected THEN
        RAISE EXCEPTION
            'Refusing to run: connected to database %, but target_db is %',
            current_database(), expected;
    END IF;
END
$guard$;

BEGIN;

-- Fraction of a vector's word-like lexemes that are NOT fixed points of the
-- English stemmer. NULL when the vector holds too few word-like lexemes to
-- judge, which excludes it from the selector. The sample is ordered by
-- hashtext so it is deterministic and unbiased by spelling.
CREATE OR REPLACE FUNCTION documents.unstemmed_fraction(v tsvector)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    WITH samp AS (
        SELECT x.lexeme
          FROM unnest(v) x
         WHERE x.lexeme ~ '^[a-z]{4,}$'
         ORDER BY hashtext(x.lexeme)
         LIMIT 100
    )
    SELECT CASE WHEN count(*) < 30 THEN NULL
                ELSE count(*) FILTER (
                         WHERE to_tsvector('pg_catalog.english', lexeme)::text
                               IS DISTINCT FROM '''' || lexeme || ''':1'
                     )::numeric / count(*)
           END
      FROM samp
$fn$;

COMMENT ON FUNCTION documents.unstemmed_fraction(tsvector) IS
    'Fraction of word-like lexemes that change under English stemming. Near 0 for an english-built vector, well above 0.12 for a simple-built one. NULL when unjudgeable.';

CREATE OR REPLACE FUNCTION documents.index_is_simple(v tsvector)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    SELECT coalesce(documents.unstemmed_fraction(v) >= 0.25, false)
$fn$;

COMMENT ON FUNCTION documents.index_is_simple(tsvector) IS
    'True when a vector was built with pg_catalog.simple rather than english. Threshold 0.25, deliberately well above the measured gap (english max 0.073, simple min 0.134) because the stemmer is not idempotent and correct vectors score above zero.';

COMMIT;

-- Backup in its own transaction so the batched pass starts from a committed
-- snapshot. This repair overwrites an existing populated column, so the
-- snapshot is the only route back.
BEGIN;

CREATE TABLE IF NOT EXISTS documents.documents_backup_tsconfig (
    document_id        integer PRIMARY KEY,
    text_search        tsvector,
    unstemmed_fraction numeric,
    backed_up_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO documents.documents_backup_tsconfig
        (document_id, text_search, unstemmed_fraction)
SELECT d.document_id, d.text_search, documents.unstemmed_fraction(d.text_search)
FROM documents.documents d
WHERE documents.index_is_simple(d.text_search)
  AND NOT EXISTS (
      SELECT 1 FROM documents.documents_backup_tsconfig b
      WHERE b.document_id = d.document_id
  );

COMMIT;

SELECT set_config('azlib.batch_size', :'batch_size', false);

DO $batch$
DECLARE
    step    integer := current_setting('azlib.batch_size')::integer;
    lo      integer;
    hi      integer;
    max_id  integer;
    n       integer;
    changed bigint := 0;
    t0      timestamptz := clock_timestamp();
BEGIN
    SELECT min(document_id), max(document_id) + 1
      INTO lo, max_id
      FROM documents.documents;

    IF lo IS NULL THEN
        RAISE NOTICE 'documents.documents is empty; nothing to do.';
        RETURN;
    END IF;

    WHILE lo < max_id LOOP
        hi := lo + step;

        UPDATE documents.documents d
           SET text_search = to_tsvector('pg_catalog.english', r.txt)
          FROM (
              SELECT dd.document_id,
                     (SELECT string_agg(x.lexeme, ' ' ORDER BY p.pos)
                        FROM unnest(dd.text_search) x,
                             unnest(x.positions) p(pos)) AS txt
                FROM documents.documents dd
               WHERE dd.document_id >= lo
                 AND dd.document_id <  hi
                 AND documents.index_is_simple(dd.text_search)
          ) r
         WHERE d.document_id = r.document_id
           AND r.txt IS NOT NULL;

        GET DIAGNOSTICS n = ROW_COUNT;
        changed := changed + n;

        IF n > 0 THEN
            RAISE NOTICE '  document_id %-%: repaired % (running total %)',
                lo, hi - 1, n, changed;
        END IF;

        COMMIT;
        lo := hi;
    END LOOP;

    RAISE NOTICE 'Repaired % document(s) in %', changed, clock_timestamp() - t0;
END
$batch$;

ANALYZE documents.documents;

\echo ''
\echo 'Done. Now run:'
\echo '  psql ... -f migrations/verify-fix-document-search-config.sql'
