## Why

The `json_data` blob in `metadata.azgs` has accumulated inconsistent scalar
types and untrimmed string values over successive bulk-ingest campaigns. The
same logical field is stored as different JSON types from row to row, so every
consumer has to defensively coerce, and exact-match filtering on keywords and
collection names silently misses records.

Concretely, measured against both databases. Note that `devazlib` is **not**
a copy of `azlibrary` — prod holds 894 more rows and over seven times as
many string-typed years — so the migration must be written against prod's
shapes, not dev's:

| Defect | dev (`devazlib`) | prod (`azlibrary`) |
| --- | --- | --- |
| `bounding_box.{north,south,east,west}` stored as JSON string | 22,998 rows | 23,828 rows |
| `year` stored as JSON string instead of number | 2,365 rows (44 empty) | 17,148 rows (44 empty) |
| `journal` holds citation boilerplate as a bare string | 5,331 rows | 5,331 rows |
| `journal` object present but entirely empty | not separately counted | 18,362 of 18,364 |
| `keywords[].name` with leading/trailing whitespace | 295,989 of 420,723 entries, in 15,363 rows | not separately counted |
| Duplicate `(name, type)` keyword pairs within one record | 8,446 redundant entries in 4,382 rows | not separately counted |
| `keywords[].type` split across two vocabularies | `time` 19,043 vs `temporal` 4,512 | not separately counted |
| `mine_data.collection` differing only by trailing whitespace | 2 names, 348 rows | not separately counted |
| `links[].name` one-off casing/spelling variants | 3 rows | not separately counted |
| Misspelled key `informalname` instead of `informal_name` | 5 rows | 45 rows |
| Misspelled key `author` instead of `authors` | 5 rows | 5 rows |
| `license` asserts the wrong terms (`CC BY-NC-SA 4.0`) | 22,994 rows; 2 blank, 7 absent | 23,888 rows; 2 blank, 7 absent |

Total rows: 23,003 on dev, 23,897 on prod. In both databases every string
bounding-box value and every non-blank string year casts cleanly; the only
values with no numeric equivalent are the 44 empty-string years in each,
which become `null`. Neither database has a row where a misspelled key and
its correctly spelled counterpart both appear, so the renames cannot collide.

## What Changes

- Normalize `bounding_box.{north,south,east,west}` to JSON numbers, trimming
  whitespace before the cast.
- Normalize `year` to a JSON number, with empty strings becoming `null`.
- **BREAKING** Retire `journal` in place: set it to
  `{name: null, publisher: null, url: null}` on every record. The field holds
  no legitimate bibliographic data anywhere — all 5,331 bare strings are one
  generated template (`Please cite by using: ...`), and of 18,364 object
  values 18,362 are entirely empty while the remaining two are a duplicated
  link stub and a publisher name in the wrong subfield. Before emptying, a
  bare string's text moves onto the end of the record's `abstract`; since all
  5,331 affected records currently have no `abstract`, they will gain one
  consisting of that boilerplate, which is visible in search results and on
  item pages.
- Trim `keywords[].name`, drop entries whose name is empty after trimming, and
  de-duplicate `(name, type)` pairs within each record while preserving order.
- Collapse the `time` keyword type into `temporal` so one concept has one
  vocabulary term. **BREAKING** for any caller that filters on `type = "time"`.
- Trim `mine_data.collection` and fold the three `links[].name` variants into
  the two canonical values (`AZGS old`, `UA Library`).
- Rename the misspelled keys to their documented names: `informalname` to
  `informal_name` (5 rows on dev, 45 on prod) and `author` to `authors`
  (5 rows). An empty `informalname` becomes `null` rather than an empty
  string. `informal_name` was introduced to hold shortened titles for mobile
  clients that were never built, so the field is optional, unread and
  populated on only 538 of 23,897 prod rows; exactly one affected row
  (`30872`, `OFR-26-5`) carries a real value to preserve.
- **BREAKING** Relicense every record from `CC BY-NC-SA 4.0` to `CC BY-SA 4.0`,
  setting `license.type` to `CC BY-SA 4.0` and `license.url` to
  `https://creativecommons.org/licenses/by-sa/4.0/` on all 23,003 rows,
  including the 9 whose `license` is currently blank or absent. The `NC`
  (NonCommercial) term is not correct for AZGS material.
- Apply the same migration to `azlibrary` (prod) after it is verified on
  `devazlib`, accounting for prod's larger and differently distributed
  defect population.

## Capabilities

### New Capabilities

- `metadata-json-format`: the type and value invariants that a stored
  `metadata.azgs.json_data` record satisfies — which fields are numbers,
  which are objects, and what normalization applies to string values.

### Modified Capabilities

(none — no existing spec in this repo covers the stored metadata format.)

## Impact

- **Data**: `metadata.azgs` in `devazlib`, then `azlibrary`. Both databases
  live on the same RDS cluster
  (`cos-azulibrarydatabase-prod.cluster-c0xzlo6s7duc.us-west-2.rds.amazonaws.com`),
  distinguished only by database name, so the migration must be explicit about
  which database it targets.
- **Triggers**: every `UPDATE` to `metadata.azgs` fires six `BEFORE` triggers
  that recompute `geom` and five `tsvector` columns from `json_data`. The
  migration will rewrite these for every touched row; `geom_trigger` already
  casts the bounding box to `float`, so `geom` values are unchanged by the type
  normalization.
- **Rollback**: `json_data` has no history. The migration needs a backup of the
  affected rows before it runs.
- **Out of scope — producers**: the code that writes these records is not
  corrected by this change, so re-ingestion will reintroduce the defects. Known
  writers are `azlibConvert/xmlConverter.js` and `azlibAdd/xmlConverter.js`
  (`metadata.year = date.slice(0,4)` yields a string; keyword names and bounding
  box values are copied from XML untrimmed),
  `azlibContriveMineCollections/index.js` (`journal: data.bib_citation` writes a
  bare string; `year` from `pub_date.split("-")[0]` is a string; bounding box
  literals are quoted strings). The misspelled `informalname` key has a
  separate and still-active source: the admin upload form
  (`azlibrary_admin/src/components/Collection/CollectionMutateForm.js`) names
  the field `informalname` in its default value, its Yup schema and its form
  control, and defaults it to `''`. That is why 44 of prod's 45 affected rows
  hold an empty string and why the affected rows are the newest in the table.
  The API itself (`azlibrary_api`) uses `informal_name` correctly throughout
  its OpenAPI schema and legacy form, and does not validate the metadata blob
  against that schema on write, so the misspelled key passes through to
  storage. Producer fixes are deliberately out of scope here and should be
  tracked as a follow-up change.
- **Not addressed**: `identifiers.doi` and `identifiers.collection_id` are
  present but `null` on every row; `collection_group.id` is absent on 7,701
  rows; several `collection_group.name` values differ only by a trailing
  qualifier. These are content questions rather than format defects and are
  left for a separate change. Around a dozen obvious test and placeholder
  records (titles such as `test`, `a title`, `This is not a real collection`)
  are likewise out of scope: removing them is a deletion that needs a
  reviewed list of `collection_id` values and matching treatment of the
  `public.collections` rows. This change normalizes them like any other row.
