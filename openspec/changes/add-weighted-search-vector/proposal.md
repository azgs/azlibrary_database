## Why

`metadata.azgs.kitchensink_search` has existed since the schema was first
written, carries a GIN index, and has never held a value: no trigger populates
it and no query reads it. Meanwhile the four tsvector columns that *are*
populated — `title_search`, `author_search`, `keyword_search`, `series_search` —
are each ranked independently by the API, so there is no single relevance score
for a collection and no way to say that a title hit should outrank a keyword
hit. `abstract`, the richest human-written description in the record, is not
indexed anywhere at all.

The result is that the one search box on the public site cannot be answered
with one ranked query. This change gives the database a single weighted search
vector to rank on, which is the prerequisite for any relevance work in
`azlibrary_api` and `azlibrary_react`.

## What Changes

- Add `metadata.search_vector(jsonb)`, an `IMMUTABLE` function that builds one
  weighted `tsvector` from a `json_data` blob: `title` at weight `A`,
  `keywords[].name` at `B`, `authors[].person` and `series` at `C`, and
  `abstract` at `D`.
- **BREAKING (schema)** Replace `metadata.azgs.kitchensink_search` with a
  `GENERATED ALWAYS AS (...) STORED` column over that function, and rebuild its
  GIN index. The column is dropped and re-added because a plain column cannot be
  converted to a generated one in place. Nothing is lost: the column is empty on
  every row today, which the migration asserts before it drops anything.
- Index `abstract` for the first time, as the `D`-weighted component.
- Update `azlibConfigPG/schemas/02-metadata.sql` so a freshly built database
  comes out in the same shape as a migrated one.
- Ship the migration with the preflight and verify scripts this repo's
  `migrations/` convention calls for.

Explicitly **not** in this change:

- No change to any existing trigger. `title_search`, `author_search`,
  `keyword_search` and `series_search` keep their current triggers and their
  current behaviour, so every query that reads them is unaffected. Converting
  those five triggers to generated columns is worth doing and is left to a
  follow-up.
- No change to `azlibrary_api`. The new column is inert until a query reads it,
  exactly as it is today. Wiring it to a ranked `q` parameter, fixing the
  `ORDER BY` precedence bug in `metadata.model.js` and fixing the per-document
  rank summation belong to a change in that repository, which this one unblocks.
- No weight tuning. The `A`/`B`/`C`/`D` assignment below is a starting point
  chosen from field semantics, not from measured search behaviour. Tuning needs
  query telemetry that does not yet exist.

## Capabilities

### New Capabilities

- `metadata-search-index`: the derived full-text search surface over
  `metadata.azgs` — which fields are indexed, at what weight, and the guarantee
  that the index tracks `json_data` without an explicit reindex step.

### Modified Capabilities

None. No existing spec in `openspec/specs/` describes the search index.

## Impact

- **Schema**: `metadata.azgs.kitchensink_search` is dropped and re-added as a
  generated column; `azgs_kitchensink_idx` is rebuilt over it. One new function,
  `metadata.search_vector(jsonb)`.
- **Table rewrite**: adding a `STORED` generated column rewrites the table under
  `ACCESS EXCLUSIVE`. Measured: `metadata.azgs` is 158 MB over 23,003 rows on
  `devazlib` and 130 MB over 23,897 rows on `azlibrary`. Expect tens of seconds,
  not minutes — the rewrite calls one function per row rather than firing the
  six per-row triggers that made the `normalize-metadata-json` pass take 15
  minutes. The API blocks for the duration, so run it in a quiet window.
- **Postgres version**: generated columns and `jsonpath` both require Postgres
  12 or later. Measured: both servers are **PostgreSQL 14.22**, so the design
  applies. `server-setup.txt` still describes a Postgres 10 apt install and is
  stale. The migration aborts below 12 regardless.
- **Recall gained**: measured by the preflight, the share of collections that
  gain at least one lexeme held by no current per-field vector is **98.4% on
  dev** (22,627 of 23,003) and **74.8% on prod** (17,869 of 23,897). The gap is
  `normalize-metadata-json`, which has run on dev and moves `journal` citation
  boilerplate into `abstract`: dev has 22,913 non-blank abstracts against
  prod's 18,479. Prod's figure will rise to dev's once normalize runs there.
- **Ingest**: `azlibAdd` writes `json_data` and the generated column follows
  automatically. No ingest code changes, and no backfill step: the table rewrite
  *is* the backfill.
- **Ordering with `normalize-metadata-json`**: that change rewrites the shapes
  this function reads, including `series` and `keywords[].name`. Running it
  first means the vector is built over normalized values instead of being
  rebuilt afterwards. The two are independent, but this order avoids a second
  rewrite.
- **Files**: `migrations/add-weighted-search-vector.sql`,
  `migrations/preflight-add-weighted-search-vector.sql`,
  `migrations/verify-add-weighted-search-vector.sql`,
  `azlibConfigPG/schemas/02-metadata.sql`.
