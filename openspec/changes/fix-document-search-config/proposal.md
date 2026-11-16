## Why

`azlibAdd/documents.js` builds `documents.documents.text_search` with the
one-argument `to_tsvector(text)`, which takes whatever
`default_text_search_config` the server happens to have. The API always queries
that column with `plainto_tsquery('pg_catalog.english', ...)` and
`phraseto_tsquery('pg_catalog.english', ...)`.

`default_text_search_config` is `pg_catalog.simple` on both servers today. It
has not always been, so the stored corpus is mixed:

| | devazlib | azlibrary (prod) |
| --- | --- | --- |
| documents | 20,019 | 20,639 |
| indexed under `simple` | 402 | **628** |
| collections holding at least one | 278 | **454** |
| empty vector (extraction produced nothing) | 8,513 | 8,936 |

Affected rows are identified by what fraction of a vector's lexemes change
under English stemming: `simple` stores raw words, `english` stores stems.
Measured against two hand-verified populations of 150 documents, english-built
vectors top out at 0.073 and simple-built ones start at 0.134; the threshold is
0.25, deliberately well clear of that gap. See the design for why the obvious
stopword test does not work.

A `simple`-indexed document stores `geological`, `mapping`, `mines` and keeps
English stopwords. The API searches for `geolog`, `map`, `mine`. Those
documents are reachable only by words that happen to lex identically under both
configurations. Verified against a real record on dev: document 21749 does not
match a search for "geological" today, and does after the repair below.

Because the server default is `simple` *now*, newly ingested documents keep
joining the broken set: 66 of the 92 documents ingested in 2026 are affected,
and the most recent ingest was 2026-11-12. This is an active regression.

## What Changes

- Pin the configuration in `azlibAdd/documents.js`: index document text with
  `to_tsvector('pg_catalog.english', ...)` so the stored vector cannot vary
  with server configuration, and always agrees with the queries the API issues.
- Repair the existing rows **in SQL, without re-extracting any file**. A
  `tsvector` stores lexeme positions, so the original word order can be
  reconstructed from the stored vector, re-tokenized under
  `pg_catalog.english`, and written back. Verified on dev: word order
  reconstructs into coherent text, stemming is restored, stopwords are
  stripped, and `phraseto_tsquery` matches again afterwards.
- Ship the repair with the preflight and verify scripts this repo's
  `migrations/` convention calls for, plus a runbook, matching
  `normalize-metadata-json` and `fix-bounding-box-geometries`.

Explicitly **not** in this change:

- No re-extraction from collection archives. Source files are stored as
  PostgreSQL large objects on `public.collections.archive_id`, so a faithful
  re-extraction means re-running the azlibAdd pipeline over ~940 collections.
  The SQL repair recovers the defect that matters — stemming — at a fraction of
  the cost. See the design for what it cannot recover.
- No change to the API, to the four `metadata.azgs` tsvector triggers, or to
  the server's `default_text_search_config`. The triggers and every API query
  already name `pg_catalog.english` explicitly; this is the one write that does
  not. Changing the server default would mask the bug rather than fix it, and
  would silently alter any other consumer of the default.

## Capabilities

### New Capabilities

- `document-text-index`: the full-text index over extracted document text —
  which configuration it is built with, and the guarantee that it agrees with
  the queries issued against it regardless of server settings.

### Modified Capabilities

None. No existing spec in `openspec/specs/` describes the document text index.

## Impact

- **Code**: one line in `azlibAdd/documents.js` (the `to_tsvector` call at
  line 71).
- **Data**: `documents.documents.text_search` is rewritten for the affected
  rows only — 628 of 20,639 on prod, 402 of 20,019 on dev. No other column and
  no other table is touched. Correctly indexed rows must not be rewritten:
  reconstructing an already-English vector is destructive, measured at 0 of 200
  sampled rows surviving unchanged, because its lexemes are stems rather than
  the original tokens.
- **Recoverability**: documents below the `tsvector` position cap of 16,383
  reconstruct with complete word order. Those at the cap lost their tails at
  ingest; no repair short of re-extraction restores that. The repair corrects
  stemming for every affected document and makes none of them worse.
- **Index**: `documents_ts_idx` is a GIN index on the rewritten column and will
  take the update cost; the repair should run in batches.
- **Files**: `azlibAdd/documents.js`,
  `migrations/fix-document-search-config.sql`,
  `migrations/preflight-fix-document-search-config.sql`,
  `migrations/verify-fix-document-search-config.sql`,
  `migrations/RUNBOOK-fix-document-search-config.md`.
