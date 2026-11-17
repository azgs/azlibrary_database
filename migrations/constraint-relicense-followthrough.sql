-- constraint-relicense-followthrough.sql
--
-- Makes the licence invariant hold on write rather than once.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib \
--        -f migrations/constraint-relicense-followthrough.sql
--
-- ORDER MATTERS, in two directions:
--
--   1. Run this AFTER relicense-followthrough.sql. Adding the constraint
--      validates every existing row, so it fails outright if any row still
--      carries the superseded licence.
--   2. Deploy it WITH the ingest tool fixes, not before them. A tool still
--      writing CC BY-NC-SA 4.0 will start failing its inserts the moment this
--      lands, which is correct behaviour and a bad surprise.
--
-- This task is separable. The constraint asserts that AZGS will never hold
-- material under any other licence — a faithful reading of the current spec,
-- but a policy decision wearing a schema change's clothes. See
-- openspec/changes/relicense-followthrough/design.md. If that commitment is
-- not wanted, skip this file; the repair and the tool fixes stand without it.
-- Undoing it later is one DROP CONSTRAINT and a spec change.

\set ON_ERROR_STOP on

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

ALTER TABLE metadata.azgs
    ADD CONSTRAINT azgs_license_current
    CHECK (
        json_data->'license'->>'type' = 'CC BY-SA 4.0'
    AND json_data->'license'->>'url'  = 'https://creativecommons.org/licenses/by-sa/4.0/'
    );

\echo ''
\echo 'Constraint azgs_license_current added. Prove it rejects the old value:'
\echo '  update metadata.azgs set json_data = jsonb_set(json_data, ''{license,type}'', ''"CC BY-NC-SA 4.0"'') where metadata_id = (select min(metadata_id) from metadata.azgs);'
\echo 'That statement must fail. Roll back if you ran it in a transaction.'
\echo ''
