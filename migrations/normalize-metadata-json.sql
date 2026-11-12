-- normalize-metadata-json.sql
--
-- Normalizes scalar types and string values in metadata.azgs.json_data, and
-- relicenses every record to CC BY-SA 4.0.
-- See openspec/changes/normalize-metadata-json/ for the spec and design.
--
-- Usage:
--   psql -h <host> -U <user> -d devazlib -v target_db=devazlib \
--        -f migrations/normalize-metadata-json.sql
--
-- Idempotent: a second run reports "UPDATE 0".

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
-- Backup. Written once and never overwritten, so that re-running this script
-- does not replace the original pre-migration snapshot with migrated rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata.azgs_backup_normalize (
    collection_id integer PRIMARY KEY,
    json_data     jsonb NOT NULL,
    geom          geometry,
    backed_up_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO metadata.azgs_backup_normalize (collection_id, json_data, geom)
SELECT a.collection_id, a.json_data, a.geom
FROM metadata.azgs a
WHERE NOT EXISTS (
    SELECT 1 FROM metadata.azgs_backup_normalize b
    WHERE b.collection_id = a.collection_id
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Transform, applied in committed batches of :batch_size rows by metadata_id.
-- The per-row BEFORE triggers on metadata.azgs recompute geom and five
-- tsvector columns, and that cost dominates: a single-statement pass over the
-- whole table ran for more than twenty minutes without completing. Batching
-- keeps each transaction and its locks short.
--
-- Every rule below is a no-op on already-normalized input, so an interrupted
-- run is resumed simply by running the script again.
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
    seen    bigint := 0;
    t0      timestamptz := clock_timestamp();
BEGIN
    SELECT min(metadata_id), max(metadata_id) + 1
      INTO lo, max_id
      FROM metadata.azgs;

    WHILE lo < max_id LOOP
        hi := lo + step;

WITH src AS (
    SELECT metadata_id, json_data AS d FROM metadata.azgs
    WHERE metadata_id >= lo AND metadata_id < hi
),

-- 1. bounding_box.{north,south,east,west}: trimmed string -> JSON number.
--    Merging with || preserves any other keys in the object.
bbox AS (
    SELECT s.metadata_id,
           CASE
               WHEN jsonb_typeof(s.d->'bounding_box') = 'object' THEN
                   jsonb_set(s.d, '{bounding_box}',
                       s.d->'bounding_box' || jsonb_build_object(
                           'north', CASE
                               WHEN jsonb_typeof(s.d->'bounding_box'->'north') = 'string'
                                    AND btrim(s.d->'bounding_box'->'north' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                               THEN to_jsonb(btrim(s.d->'bounding_box'->'north' #>> '{}')::numeric)
                               ELSE s.d->'bounding_box'->'north'
                           END,
                           'south', CASE
                               WHEN jsonb_typeof(s.d->'bounding_box'->'south') = 'string'
                                    AND btrim(s.d->'bounding_box'->'south' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                               THEN to_jsonb(btrim(s.d->'bounding_box'->'south' #>> '{}')::numeric)
                               ELSE s.d->'bounding_box'->'south'
                           END,
                           'east', CASE
                               WHEN jsonb_typeof(s.d->'bounding_box'->'east') = 'string'
                                    AND btrim(s.d->'bounding_box'->'east' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                               THEN to_jsonb(btrim(s.d->'bounding_box'->'east' #>> '{}')::numeric)
                               ELSE s.d->'bounding_box'->'east'
                           END,
                           'west', CASE
                               WHEN jsonb_typeof(s.d->'bounding_box'->'west') = 'string'
                                    AND btrim(s.d->'bounding_box'->'west' #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
                               THEN to_jsonb(btrim(s.d->'bounding_box'->'west' #>> '{}')::numeric)
                               ELSE s.d->'bounding_box'->'west'
                           END
                       ))
               ELSE s.d
           END AS d
    FROM src s
),

-- 2. year: numeric string -> number; blank string -> null. A non-numeric,
--    non-blank string is left alone rather than destroyed; the verification
--    suite flags it.
yr AS (
    SELECT metadata_id,
           CASE
               WHEN jsonb_typeof(d->'year') <> 'string' THEN d
               WHEN btrim(d->>'year') = '' THEN jsonb_set(d, '{year}', 'null'::jsonb)
               WHEN btrim(d->>'year') ~ '^-?\d+$'
                   THEN jsonb_set(d, '{year}', to_jsonb(btrim(d->>'year')::bigint))
               ELSE d
           END AS d
    FROM bbox
),

-- 3. journal: vestigial. The field holds no legitimate bibliographic data
--    anywhere in the library: bare strings are one generated citation
--    template, and of the object-valued rows all but two are entirely empty
--    (one of those two duplicates a link the record already has, the other
--    holds a publisher name in the wrong subfield). Emptied unconditionally on
--    every row, after a bare string's text is moved onto the end of the
--    abstract so that no text is silently dropped. Re-running is safe: journal
--    is no longer a string afterwards, so the append cannot repeat.
jrnl AS (
    SELECT metadata_id,
           jsonb_set(
               CASE
                   WHEN jsonb_typeof(d->'journal') = 'string' THEN
                       jsonb_set(d, '{abstract}',
                           to_jsonb(
                               CASE
                                   WHEN COALESCE(btrim(d->>'abstract'), '') = ''
                                       THEN btrim(d->>'journal')
                                   WHEN position(btrim(d->>'journal') IN (d->>'abstract')) > 0
                                       THEN d->>'abstract'
                                   ELSE btrim(d->>'abstract') || ' ' || btrim(d->>'journal')
                               END),
                           true)
                   ELSE d
               END,
               '{journal}',
               jsonb_build_object('name', NULL, 'publisher', NULL, 'url', NULL),
               true) AS d
    FROM yr
),

-- 4. keywords: trim names, drop blanks, collapse time -> temporal, then
--    de-duplicate on (name, type) keeping the first occurrence. The collapse
--    must precede the de-duplication so that {1920s,time} and
--    {1920s,temporal} in one record reduce to a single entry.
kw_elems AS (
    SELECT j.metadata_id,
           e.ord,
           btrim(e.x->>'name') AS nm,
           CASE WHEN e.x->>'type' = 'time' THEN 'temporal' ELSE e.x->>'type' END AS ty
    FROM jrnl j
    CROSS JOIN LATERAL jsonb_array_elements(j.d->'keywords') WITH ORDINALITY AS e(x, ord)
    WHERE jsonb_typeof(j.d->'keywords') = 'array'
),
kw_dedup AS (
    SELECT DISTINCT ON (metadata_id, nm, ty) metadata_id, ord, nm, ty
    FROM kw_elems
    WHERE nm <> ''
    ORDER BY metadata_id, nm, ty, ord
),
kw_agg AS (
    SELECT metadata_id,
           jsonb_agg(jsonb_build_object('name', nm, 'type', ty) ORDER BY ord) AS keywords
    FROM kw_dedup
    GROUP BY metadata_id
),
kw AS (
    SELECT j.metadata_id,
           CASE
               WHEN jsonb_typeof(j.d->'keywords') = 'array'
                   THEN jsonb_set(j.d, '{keywords}',
                            COALESCE(k.keywords, '[]'::jsonb))
               ELSE j.d
           END AS d
    FROM jrnl j
    LEFT JOIN kw_agg k USING (metadata_id)
),

-- 5. links[].name: fold casing and spelling variants into the two canonical
--    values, leaving each link's url untouched.
lnk_agg AS (
    SELECT w.metadata_id,
           jsonb_agg(
               jsonb_set(e.x, '{name}', to_jsonb(
                   CASE WHEN lower(btrim(e.x->>'name')) = 'ua library'
                        THEN 'UA Library' ELSE 'AZGS old' END))
               ORDER BY e.ord) AS links
    FROM kw w
    CROSS JOIN LATERAL jsonb_array_elements(w.d->'links') WITH ORDINALITY AS e(x, ord)
    WHERE jsonb_typeof(w.d->'links') = 'array'
    GROUP BY w.metadata_id
),
lnk AS (
    SELECT w.metadata_id,
           CASE
               WHEN jsonb_typeof(w.d->'links') = 'array'
                   THEN jsonb_set(w.d, '{links}', COALESCE(l.links, '[]'::jsonb))
               ELSE w.d
           END AS d
    FROM kw w
    LEFT JOIN lnk_agg l USING (metadata_id)
),

-- 6. mine_data.collection: trim.
mine AS (
    SELECT metadata_id,
           CASE
               WHEN jsonb_typeof(d->'mine_data'->'collection') = 'string'
                   THEN jsonb_set(d, '{mine_data,collection}',
                            to_jsonb(btrim(d->'mine_data'->>'collection')))
               ELSE d
           END AS d
    FROM lnk
),

-- 7. Misspelled keys -> documented names. Values are preserved and no row is
--    deleted. A correctly spelled key that already exists is never overwritten.
--    An informalname holding only whitespace becomes null rather than an empty
--    string, matching the documented default for this field.
keys AS (
    SELECT metadata_id,
           CASE WHEN d ? 'informalname' THEN
                    (CASE WHEN d ? 'informal_name' THEN d
                          ELSE jsonb_set(d, '{informal_name}',
                                   CASE
                                       WHEN jsonb_typeof(d->'informalname') <> 'string'
                                           THEN d->'informalname'
                                       WHEN btrim(d->>'informalname') = ''
                                           THEN 'null'::jsonb
                                       ELSE to_jsonb(btrim(d->>'informalname'))
                                   END) END)
                    - 'informalname'
                ELSE d
           END AS d
    FROM mine
),
keys2 AS (
    SELECT metadata_id,
           CASE WHEN d ? 'author' THEN
                    (CASE WHEN d ? 'authors' THEN d
                          ELSE jsonb_set(d, '{authors}', d->'author') END)
                    - 'author'
                ELSE d
           END AS d
    FROM keys
),

-- 8. license: assigned unconditionally, which also fills the rows whose
--    license is currently blank or absent.
lic AS (
    SELECT metadata_id,
           jsonb_set(d, '{license}', jsonb_build_object(
               'type', 'CC BY-SA 4.0',
               'url',  'https://creativecommons.org/licenses/by-sa/4.0/'
           ), true) AS d
    FROM keys2
)

UPDATE metadata.azgs m
SET json_data = f.d
FROM lic f
WHERE m.metadata_id = f.metadata_id
  AND m.json_data IS DISTINCT FROM f.d;

        GET DIAGNOSTICS n = ROW_COUNT;
        changed := changed + n;
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
