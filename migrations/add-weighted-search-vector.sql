-- add-weighted-search-vector.sql
--
-- Replaces the unused metadata.azgs.kitchensink_search column with a weighted,
-- abstract-inclusive composite tsvector maintained as a GENERATED column.
-- See openspec/changes/add-weighted-search-vector/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib \
--        -f migrations/add-weighted-search-vector.sql
--
-- Run migrations/preflight-add-weighted-search-vector.sql first: it is
-- read-only and reports the server version, the text search configuration and
-- the table size this script is about to rewrite.
--
-- Idempotent: a second run reports "already generated" and changes nothing.
--
-- NO BACKUP TABLE. This departs from the convention in migrations/README.md,
-- deliberately. The script writes no row, modifies no json_data and no geom,
-- and the column it adds is derived from json_data. Rollback is:
--     ALTER TABLE metadata.azgs DROP COLUMN kitchensink_search;
-- after which the database is in exactly its pre-migration state.
--
-- WARNING -- STALENESS AFTER A FUNCTION CHANGE.
-- PostgreSQL does not recompute a generated column when the function behind it
-- changes. Running CREATE OR REPLACE FUNCTION on metadata.search_vector() will
-- leave every existing row holding a vector built by the OLD definition, with
-- no error and no warning. After any change to the weights or the field list:
--     ALTER TABLE metadata.azgs DROP COLUMN kitchensink_search;
-- then re-run this script, which rebuilds the column from the new definition.
-- migrations/verify-add-weighted-search-vector.sql detects the stale state.
--
-- COST. Adding a STORED generated column rewrites the table under ACCESS
-- EXCLUSIVE. At roughly 23,900 rows this is seconds, but the API blocks for
-- the duration. Run it in a quiet window.

\set ON_ERROR_STOP on
\timing on

SET azlib.target_db = :'target_db';

-- Abort unless we are connected to the database named on the command line.
-- devazlib and azlibrary share a host, so this is the only thing standing
-- between a dev run and a prod run.
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

-- Generated columns arrived in PostgreSQL 12. server-setup.txt still describes
-- a Postgres 10 apt install; that file predates RDS. Assert rather than assume.
DO $guard$
BEGIN
    IF current_setting('server_version_num')::int < 120000 THEN
        RAISE EXCEPTION
            'Refusing to run: generated columns require PostgreSQL 12 or later, but this server is %. See the design document for the trigger-based fallback.',
            current_setting('server_version');
    END IF;
END
$guard$;

BEGIN;

-- ---------------------------------------------------------------------------
-- The vector itself.
--
-- This lives in a function rather than inline in the ALTER TABLE below for a
-- hard reason, not a stylistic one: a generated column expression may not
-- contain a subquery, and aggregating keywords[].name and authors[].person
-- requires one. Wrapping the logic in a function moves the subqueries inside a
-- function body, where they are permitted.
--
-- Weights:  A title   B keywords   C authors + series   D abstract
-- ts_rank_cd's default weights are {D,C,B,A} = {0.1, 0.2, 0.4, 1.0}, so a
-- title hit contributes ten times what an abstract hit does.
--
-- to_tsvector is always called with an explicit 'pg_catalog.english'. The
-- two-argument form is IMMUTABLE; the one-argument form is only STABLE,
-- because it reads the default_text_search_config GUC, and a generated column
-- cannot use it.
--
-- The two aggregates order by WITH ORDINALITY. Unordered string_agg has no
-- defined order, which would let two rewrites of the same row produce vectors
-- with identical lexemes at different positions -- and ts_rank_cd is
-- position-sensitive. The ordering is what makes IMMUTABLE honest here.
--
-- Field extraction mirrors the existing per-field triggers, including their
-- tolerance for absent and wrongly-typed keys: a record missing every field
-- yields the empty tsvector rather than NULL.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION metadata.search_vector(d jsonb)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
    SELECT
        setweight(to_tsvector('pg_catalog.english',
            coalesce(d->>'title', '')), 'A')
     || setweight(to_tsvector('pg_catalog.english',
            coalesce(
                (SELECT string_agg(e.x->>'name', ' ' ORDER BY e.ord)
                   FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(d->'keywords') = 'array'
                                 THEN d->'keywords'
                                 ELSE '[]'::jsonb
                            END
                        ) WITH ORDINALITY AS e(x, ord)),
                '')), 'B')
     || setweight(to_tsvector('pg_catalog.english',
            concat_ws(' ',
                (SELECT string_agg(e.x->>'person', ' ' ORDER BY e.ord)
                   FROM jsonb_array_elements(
                            CASE WHEN jsonb_typeof(d->'authors') = 'array'
                                 THEN d->'authors'
                                 ELSE '[]'::jsonb
                            END
                        ) WITH ORDINALITY AS e(x, ord)),
                d->>'series')), 'C')
     || setweight(to_tsvector('pg_catalog.english',
            coalesce(d->>'abstract', '')), 'D')
$fn$;

COMMENT ON FUNCTION metadata.search_vector(jsonb) IS
    'Weighted composite search vector over json_data: A=title, B=keywords, C=authors+series, D=abstract. Backs the generated column metadata.azgs.kitchensink_search; changing this function does NOT recompute that column -- see migrations/add-weighted-search-vector.sql.';

-- ---------------------------------------------------------------------------
-- Replace the column.
--
-- PostgreSQL before 18 cannot convert a plain column into a stored generated
-- one, so the column is dropped and re-added. That is safe only because the
-- column is empty on every row, which is asserted rather than assumed.
-- Dropping the column also drops azgs_kitchensink_idx, recreated below.
-- ---------------------------------------------------------------------------
DO $do$
DECLARE
    gen       text;
    populated bigint;
BEGIN
    SELECT c.is_generated INTO gen
      FROM information_schema.columns c
     WHERE c.table_schema = 'metadata'
       AND c.table_name   = 'azgs'
       AND c.column_name  = 'kitchensink_search';

    IF gen = 'ALWAYS' THEN
        RAISE NOTICE 'kitchensink_search is already a generated column; nothing to do.';
        RAISE NOTICE 'If metadata.search_vector() has changed since it was built, the stored values are STALE.';
        RAISE NOTICE 'To rebuild: ALTER TABLE metadata.azgs DROP COLUMN kitchensink_search; then re-run this script.';
        RETURN;
    END IF;

    IF gen IS NULL THEN
        RAISE NOTICE 'kitchensink_search is absent; creating it.';
    ELSE
        SELECT count(*) INTO populated
          FROM metadata.azgs
         WHERE kitchensink_search IS NOT NULL
           AND kitchensink_search <> ''::tsvector;

        IF populated > 0 THEN
            RAISE EXCEPTION
                'Refusing to run: kitchensink_search holds a value on % row(s). This script expects the column to be unused and would discard that data. Investigate before proceeding.',
                populated;
        END IF;

        RAISE NOTICE 'kitchensink_search is empty on every row; replacing it.';
        EXECUTE 'ALTER TABLE metadata.azgs DROP COLUMN kitchensink_search';
    END IF;

    EXECUTE 'ALTER TABLE metadata.azgs ADD COLUMN kitchensink_search tsvector GENERATED ALWAYS AS (metadata.search_vector(json_data)) STORED';
END
$do$;

CREATE INDEX IF NOT EXISTS azgs_kitchensink_idx
    ON metadata.azgs USING gin (kitchensink_search);

COMMIT;

-- The rewrite invalidated the table's statistics.
ANALYZE metadata.azgs;

\echo ''
\echo 'Done. Now run:'
\echo '  psql ... -f migrations/verify-add-weighted-search-vector.sql'
