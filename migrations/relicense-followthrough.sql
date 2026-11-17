-- relicense-followthrough.sql
--
-- Sets the current licence object on every record that does not already carry
-- it. See openspec/changes/relicense-followthrough/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib -v batch_size=500 \
--        -f migrations/relicense-followthrough.sql
--
-- Run preflight-relicense-followthrough.sql first and read its output. The
-- number of affected rows is not known in advance.
--
-- Idempotent: a second run reports 0 rows changed.

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

-- Backup runs in its own transaction so the batched pass starts from a
-- committed snapshot. Only the licence is kept: unlike normalize, this script
-- touches one key, so a whole-row snapshot would imply it might not.
BEGIN;

CREATE TABLE IF NOT EXISTS metadata.azgs_backup_relicense (
    collection_id integer PRIMARY KEY,
    license       jsonb,
    backed_up_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO metadata.azgs_backup_relicense (collection_id, license)
SELECT a.collection_id, a.json_data->'license'
FROM metadata.azgs a
WHERE (a.json_data->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'
    OR a.json_data->'license'->>'url'  IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/')
  AND NOT EXISTS (
      SELECT 1 FROM metadata.azgs_backup_relicense b
      WHERE b.collection_id = a.collection_id
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- Repair, applied in committed batches of :batch_size rows by metadata_id.
--
-- The batching is not proportionate to the expected row count, which may well
-- be small. It is here because each row fires six BEFORE triggers that rebuild
-- geom and five tsvector columns, and because the next person to write a
-- repair against this table will copy this script. normalize-metadata-json ran
-- more than twenty minutes as a single statement without completing.
-- ---------------------------------------------------------------------------

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
    license_obj constant jsonb := jsonb_build_object(
        'type', 'CC BY-SA 4.0',
        'url',  'https://creativecommons.org/licenses/by-sa/4.0/'
    );
BEGIN
    SELECT min(metadata_id), max(metadata_id) + 1
      INTO lo, max_id
      FROM metadata.azgs;

    IF lo IS NULL THEN
        RAISE NOTICE 'metadata.azgs is empty, nothing to do';
        RETURN;
    END IF;

    WHILE lo < max_id LOOP
        hi := lo + step;

        -- Assigned unconditionally to the rows that need it, which also fills
        -- rows whose licence is absent, blank, or half-correct.
        UPDATE metadata.azgs a
           SET json_data = jsonb_set(a.json_data, '{license}', license_obj)
         WHERE a.metadata_id >= lo AND a.metadata_id < hi
           AND (a.json_data->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'
             OR a.json_data->'license'->>'url'  IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/');

        GET DIAGNOSTICS n = ROW_COUNT;
        changed := changed + n;

        COMMIT;

        IF (lo / step) % 20 = 0 THEN
            RAISE NOTICE 'metadata_id < % : % rows changed so far, elapsed %',
                hi, changed, clock_timestamp() - t0;
        END IF;

        lo := hi;
    END LOOP;

    RAISE NOTICE 'done: % rows changed, elapsed %', changed, clock_timestamp() - t0;
END
$batch$;
