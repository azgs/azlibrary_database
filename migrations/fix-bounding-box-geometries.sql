-- fix-bounding-box-geometries.sql
--
-- Repairs bounding boxes in metadata.azgs whose longitudes were stored with
-- the wrong sign, or with east/west (or, in one record, east/south)
-- transposed.
-- See openspec/changes/fix-bounding-box-geometries/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib -v batch_size=2000 \
--        -f migrations/fix-bounding-box-geometries.sql
--
-- Writes json_data only. metadata.geom_trigger() recomputes geom from the
-- corrected bounding box on every UPDATE; a direct write to geom would be
-- overwritten by the trigger in the same statement.
--
-- Idempotent: a second run reports "0 rows changed". Every rule's condition
-- is false once that rule has been applied.
--
-- Run preflight-fix-bounding-box-geometries.sql first.

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

-- Backup runs in its own transaction so that the batched pass below starts
-- from a committed snapshot.
BEGIN;

-- ---------------------------------------------------------------------------
-- Backup, part 1: the geometry of every row, with no rule logic at all.
--
-- This is what makes "every untouched row kept its geometry" checkable
-- without reference to any earlier migration's snapshot. It is deliberately
-- rule-independent, so it cannot fall out of step if the rule set changes.
-- json_data is NOT stored here; part 2 captures it per row, below, for only
-- the rows that actually change. Carrying json_data for all 23,898 rows would
-- duplicate ~40 MB to no purpose.
--
-- Rows are written once and never overwritten, so re-running this script does
-- not replace the original pre-migration snapshot with repaired rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata.azgs_backup_geometry (
    collection_id integer PRIMARY KEY,
    json_data     jsonb,
    geom          geometry,
    geom_wkt      text,
    will_repair   boolean NOT NULL DEFAULT false,
    backed_up_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO metadata.azgs_backup_geometry (collection_id, geom, geom_wkt)
SELECT a.collection_id, a.geom, ST_AsText(a.geom)
FROM metadata.azgs a
WHERE NOT EXISTS (
    SELECT 1 FROM metadata.azgs_backup_geometry b
    WHERE b.collection_id = a.collection_id
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Repair, applied in committed batches of :batch_size rows by metadata_id.
--
-- Only 463 rows change, but the UPDATE must still scan every row to evaluate
-- the rules, and the six per-row BEFORE triggers on metadata.azgs dominate
-- the cost of each row that does change. Batching keeps each transaction and
-- its locks short, and leaves committed progress if the run is interrupted.
-- ---------------------------------------------------------------------------

SELECT set_config('azlib.batch_size', :'batch_size', false);

DO $batch$
DECLARE
    step    integer := current_setting('azlib.batch_size')::integer;
    lo      integer;
    hi      integer;
    max_id  integer;
    -- Named n_rows, not n: the transform's CTEs alias the north coordinate
    -- as n, and plpgsql resolves a bare n to the variable, which makes the
    -- column reference ambiguous and aborts the batch.
    n_rows  integer;
    changed bigint := 0;
    seen    bigint := 0;
    t0      timestamptz := clock_timestamp();
BEGIN
    SELECT min(metadata_id), max(metadata_id) + 1
      INTO lo, max_id
      FROM metadata.azgs;

    WHILE lo < max_id LOOP
        hi := lo + step;

WITH src AS (
    SELECT a.metadata_id,
           a.collection_id,
           a.json_data AS d,
           (a.json_data->'bounding_box'->>'north')::numeric AS n,
           (a.json_data->'bounding_box'->>'south')::numeric AS s,
           (a.json_data->'bounding_box'->>'east')::numeric  AS e,
           (a.json_data->'bounding_box'->>'west')::numeric  AS w
    FROM metadata.azgs a
    WHERE a.metadata_id >= lo AND a.metadata_id < hi
      AND jsonb_typeof(a.json_data->'bounding_box'->'north') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'south') = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'east')  = 'number'
      AND jsonb_typeof(a.json_data->'bounding_box'->'west')  = 'number'
),

-- The three rules are disjoint, so their order inside the CASE expressions
-- below cannot matter. Applying them as one UPDATE rather than three means
-- no row is written twice and each pays the trigger cost once.
cls AS (
    SELECT src.*,
           -- Rule A: both longitudes stored as positive magnitudes, and
           -- negating both lands the box in Arizona. The second half is the
           -- guard that spares records genuinely in the eastern hemisphere.
           (e > 0 AND w > 0 AND abs(n) <= 90 AND abs(s) <= 90
            AND ST_Intersects(
                    ST_MakeEnvelope(-greatest(abs(e), abs(w)), least(s, n),
                                    -least(abs(e), abs(w)),    greatest(s, n), 4326),
                    ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326))) AS rule_a,
           -- Rule B: east and west transposed, both already negative. Both
           -- negative is required so that an extent legitimately crossing the
           -- antimeridian, where west > east is correct, is never touched.
           (w > e AND e < 0 AND w < 0) AS rule_b,
           -- Rule C: collection 27608, east and south transposed. Keyed on
           -- the stored values as well as the id, so that a re-run does not
           -- transpose them a second time and undo the repair.
           (collection_id = 27608
            AND n =   37.23233485 AND s = -108.8724393
            AND e =   31.13035647 AND w = -115.0247831) AS rule_c,
           -- Rule D: west alone stored as a positive magnitude. Rule A needs
           -- both longitudes positive, so it does not see this; the resulting
           -- envelope spans the globe and matches map searches everywhere.
           (w > 0 AND e < 0 AND abs(n) <= 90 AND abs(s) <= 90
            AND ST_Intersects(
                    ST_MakeEnvelope(least(-w, e), least(s, n),
                                    greatest(-w, e), greatest(s, n), 4326),
                    ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326))) AS rule_d,
           -- Rule E: north and south transposed. Unlike the longitude rules
           -- this needs no Arizona guard: a bounding box must have
           -- south <= north everywhere on earth, and there is no latitude
           -- equivalent of crossing the antimeridian.
           (s > n) AS rule_e
    FROM src
),

-- Rules A and D compute both longitudes from the magnitudes, so the pair
-- comes out in ascending order whichever order it was stored in. Rule E only
-- touches the latitudes, so it composes with a longitude rule rather than
-- competing with it.
fx AS (
    SELECT metadata_id, d,
           CASE WHEN rule_e THEN s ELSE n END AS n2,
           CASE WHEN rule_c THEN e
                WHEN rule_e THEN n
                ELSE s END AS s2,
           CASE WHEN rule_a THEN -least(abs(e), abs(w))
                WHEN rule_b THEN w
                WHEN rule_c THEN s
                WHEN rule_d THEN greatest(-w, e)
                ELSE e END AS e2,
           CASE WHEN rule_a THEN -greatest(abs(e), abs(w))
                WHEN rule_b THEN e
                WHEN rule_d THEN least(-w, e)
                ELSE w END AS w2
    FROM cls
    WHERE rule_a OR rule_b OR rule_c OR rule_d OR rule_e
),

-- Merging with || preserves any other keys in the bounding_box object.
sel AS (
    SELECT metadata_id,
           jsonb_set(d, '{bounding_box}',
               d->'bounding_box' || jsonb_build_object(
                   'north', to_jsonb(n2),
                   'south', to_jsonb(s2),
                   'east',  to_jsonb(e2),
                   'west',  to_jsonb(w2)
               ), true) AS d2
    FROM fx
),

-- Backup, part 2: capture each changing row's pre-image json_data in the
-- same statement that repairs it, under the same snapshot, so what is stored
-- is exactly the value about to be overwritten. Deriving the backup from the
-- transform rather than from a second copy of the rule set means the two can
-- never disagree, including when the rule set grows between runs.
--
-- "json_data IS NULL" makes this write-once: a row already backed up by an
-- earlier run keeps its original pre-image.
bk AS (
    UPDATE metadata.azgs_backup_geometry b
    SET json_data = m.json_data, will_repair = true
    FROM metadata.azgs m, sel f
    WHERE b.collection_id = m.collection_id
      AND m.metadata_id = f.metadata_id
      AND m.json_data IS DISTINCT FROM f.d2
      AND b.json_data IS NULL
    RETURNING 1
)

UPDATE metadata.azgs m
SET json_data = f.d2
FROM sel f
WHERE m.metadata_id = f.metadata_id
  AND m.json_data IS DISTINCT FROM f.d2;

        GET DIAGNOSTICS n_rows = ROW_COUNT;
        changed := changed + n_rows;
        seen := seen + step;
        COMMIT;

        IF (seen / step) % 10 = 0 THEN
            RAISE NOTICE 'metadata_id < % : % rows changed so far, elapsed %',
                hi, changed, clock_timestamp() - t0;
        END IF;

        lo := hi;
    END LOOP;

    RAISE NOTICE 'done: % rows changed, elapsed %', changed, clock_timestamp() - t0;
END
$batch$;
