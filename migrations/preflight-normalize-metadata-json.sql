-- preflight-normalize-metadata-json.sql
--
-- READ-ONLY. Runs the exact transform from normalize-metadata-json.sql as a
-- pure expression and asserts the spec against its computed output, without
-- writing anything or firing a single trigger. Run this against a database
-- immediately before migrating it.
--
-- Usage:
--   psql -h <host> -U <user> -d azlibrary -f migrations/preflight-normalize-metadata-json.sql
--
-- Every assertion must report PASS. Row 18 is informational: the number of
-- rows the migration would rewrite.
--
-- Keep in step with normalize-metadata-json.sql: the CTE chain below is copied
-- from it verbatim apart from the batch bound, which is removed.

WITH src AS (
    SELECT metadata_id, json_data AS d FROM metadata.azgs
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
, vfinal AS (
    SELECT a.metadata_id, a.collection_id, a.json_data AS old, f.d AS new
    FROM metadata.azgs a JOIN lic f USING (metadata_id)
),
vkw AS (
    SELECT metadata_id, e.x FROM vfinal, LATERAL jsonb_array_elements(new->'keywords') e(x)
    WHERE jsonb_typeof(new->'keywords')='array'
),
vkwdup AS (
    SELECT metadata_id FROM vkw GROUP BY metadata_id, x->>'name', x->>'type' HAVING count(*)>1
),
vlk AS (
    SELECT metadata_id, e.x FROM vfinal, LATERAL jsonb_array_elements(new->'links') e(x)
    WHERE jsonb_typeof(new->'links')='array'
),
vchecks AS (
    SELECT 1 n,'bbox coords are numbers' a, count(*) v FROM vfinal, LATERAL (VALUES('north'),('south'),('east'),('west')) t(k)
      WHERE jsonb_typeof(new->'bounding_box')='object' AND jsonb_typeof(new->'bounding_box'->t.k) IS DISTINCT FROM 'number'
    UNION ALL SELECT 2,'year is number or null',count(*) FROM vfinal WHERE jsonb_typeof(new->'year') NOT IN ('number','null')
    UNION ALL SELECT 3,'journal is the empty object everywhere',count(*) FROM vfinal
      WHERE new->'journal' IS DISTINCT FROM '{"name": null, "publisher": null, "url": null}'::jsonb
    UNION ALL SELECT 4,'keyword names trimmed',count(*) FROM vkw WHERE (x->>'name')<>btrim(x->>'name')
    UNION ALL SELECT 5,'no blank keyword names',count(*) FROM vkw WHERE btrim(x->>'name')=''
    UNION ALL SELECT 6,'keyword (name,type) unique per record',count(*) FROM vkwdup
    UNION ALL SELECT 7,'keyword vocab is place/theme/temporal',count(*) FROM vkw WHERE x->>'type' NOT IN ('place','theme','temporal')
    UNION ALL SELECT 8,'mine_data.collection trimmed',count(*) FROM vfinal
      WHERE jsonb_typeof(new->'mine_data'->'collection')='string' AND (new->'mine_data'->>'collection')<>btrim(new->'mine_data'->>'collection')
    UNION ALL SELECT 9,'link names canonical',count(*) FROM vlk WHERE x->>'name' NOT IN ('AZGS old','UA Library')
    UNION ALL SELECT 10,'no misspelled keys',count(*) FROM vfinal WHERE new ? 'author' OR new ? 'informalname'
    UNION ALL SELECT 11,'every row is CC BY-SA 4.0',count(*) FROM vfinal
      WHERE new->'license'->>'type' IS DISTINCT FROM 'CC BY-SA 4.0'
         OR new->'license'->>'url'  IS DISTINCT FROM 'https://creativecommons.org/licenses/by-sa/4.0/'
    UNION ALL SELECT 12,'no NC terms remain',count(*) FROM vfinal WHERE (new->'license')::text ILIKE '%nc%'
    UNION ALL SELECT 13,'journal boilerplate landed in abstract',count(*) FROM vfinal
      WHERE jsonb_typeof(old->'journal')='string'
        AND position(btrim(old->>'journal') IN COALESCE(new->>'abstract',''))=0
    UNION ALL SELECT 14,'links array unchanged in length',count(*) FROM vfinal
      WHERE jsonb_typeof(old->'links')='array'
        AND jsonb_array_length(old->'links') IS DISTINCT FROM jsonb_array_length(new->'links')
    UNION ALL SELECT 15,'bbox numeric value preserved',count(*) FROM vfinal, LATERAL (VALUES('north'),('south'),('east'),('west')) t(k)
      WHERE jsonb_typeof(old->'bounding_box'->t.k) IS NOT NULL
        AND (old->'bounding_box'->>t.k)::numeric IS DISTINCT FROM (new->'bounding_box'->>t.k)::numeric
    UNION ALL SELECT 16,'year value preserved where numeric',count(*) FROM vfinal
      WHERE btrim(COALESCE(old->>'year',''))<>'' AND (old->>'year')::bigint IS DISTINCT FROM (new->>'year')::bigint
    UNION ALL SELECT 17,'informal_name empty became null',count(*) FROM vfinal
      WHERE old ? 'informalname' AND btrim(COALESCE(old->>'informalname',''))=''
        AND jsonb_typeof(new->'informal_name') IS DISTINCT FROM 'null'
    UNION ALL SELECT 18,'rows the migration would rewrite', count(*) FROM vfinal WHERE old IS DISTINCT FROM new
)
SELECT n, a AS assertion, v AS violations,
       CASE WHEN n=18 THEN 'INFO' WHEN v=0 THEN 'PASS' ELSE 'FAIL' END result
FROM vchecks ORDER BY n;
