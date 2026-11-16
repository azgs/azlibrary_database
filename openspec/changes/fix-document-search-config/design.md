## Context

`documents.documents.text_search` is the index behind the site's Full-Text
Search box — the one the UI describes as casting "the widest possible net". It
is written in exactly one place, `azlibAdd/documents.js` line 71, with a
config-less `to_tsvector(text)`. That form is not a typo so much as a trap: it
compiles, it works, and it silently binds the stored vector to whatever
`default_text_search_config` the server carries at that moment.

Everything else in the system names its configuration explicitly. All four
`metadata.azgs` tsvector triggers use `to_tsvector('pg_catalog.english', ...)`.
Every query the API issues uses `plainto_tsquery('pg_catalog.english', ...)` or
`phraseto_tsquery('pg_catalog.english', ...)`. This one write is the outlier,
and the servers' current default is `pg_catalog.simple`.

## Goals

- Make the stored vector independent of server configuration.
- Repair the existing rows without re-extracting text from any source file.
- Touch no correctly indexed row.

## Decisions

### Pin the configuration at the write site, not the server

The obvious alternative is to set `default_text_search_config = english` on the
RDS parameter group. Rejected: it masks the bug rather than fixing it, it
silently changes behaviour for every other consumer of the default, and it
leaves the code just as fragile the next time a server is provisioned. One
explicit argument at the call site is the fix.

### Repair from the stored vector, not from the source files

A `tsvector` stores each lexeme with its positions, so the original word
sequence can be reconstructed by expanding positions and ordering by them.
Verified on dev against document 21749, a 20,765-lexeme PDF: the reconstruction
reads as coherent text — "arizona geological survey 1955 e 6th st po box
210184 tucson az 85721 ..." — and re-tokenizing it under `pg_catalog.english`
produced a vector that matches `plainto_tsquery('english','geological')`, holds
no stopword lexeme, and still satisfies `phraseto_tsquery('english','arizona
geological survey')`. Before the repair, that document did not match a search
for "geological" at all.

The alternative is re-extraction. Source files live as PostgreSQL large objects
on `public.collections.archive_id` — one archive per collection, not per
document — so a faithful re-extraction means fetching and unpacking ~5,900
archives and re-running textract/mammoth over them: the azlibAdd pipeline, not
a `psql -f`. The SQL repair recovers the defect that actually matters, at a
fraction of the cost and with no file access.

### The repair SHALL run only on affected rows

This is a correctness constraint, not an optimisation. Reconstruction is
faithful for a `simple`-built vector because `simple` only lowercases and
splits, so its lexemes *are* the original tokens. It is destructive for an
`english`-built vector, whose lexemes are already stems: re-joining stems with
spaces and re-parsing them does not round-trip. Measured on a 200-row sample of
correctly indexed documents, **0 came out identical** and only 14 kept even the
same lexeme set. A blanket "repair everything" pass would corrupt two thirds of
the corpus to fix one third.

### Detecting affected rows

**Not by stopword.** The intuitive test — a vector built with `english` cannot
hold an English stopword, because `english` strips them — is false, and acting
on it corrupted 6,637 rows on `devazlib` before they were rolled back from the
snapshot. The stopword filter runs on the token *before* stemming, so an
ordinary word whose stem equals a stopword puts that stopword into a perfectly
correct English vector: "owned" gives `own`, "mostly" gives `most`, "willing"
gives `will`, "others" gives `other`. On dev, `own` appears in 3,152 of 11,007
definitively English-built documents. Of the 6,637 rows that selector chose,
only 387 held 20 or more stopword lexemes — the profile of genuine prose
indexed under `simple`; 1,708 held exactly one.

**By stemming instead.** `simple` stores raw words, so many of its lexemes are
not fixed points of the stemmer: `to_tsvector('english','geological')` is
`geolog`. `english` stores stems. Scoring a document by the fraction of its
word-like lexemes that change under stemming separates the populations and is
immune to the stemmer-output problem entirely.

`documents.unstemmed_fraction(tsvector)` samples up to 100 lexemes matching
`^[a-z]{4,}$`, ordered by `hashtext` so the sample is deterministic and not
biased by spelling, and returns NULL below 30 lexemes so unjudgeable documents
are excluded rather than guessed at. Measured against two hand-verified
populations of 150 documents each on dev:

| | min | p05 | median | p95 | max |
| --- | --- | --- | --- | --- | --- |
| english-built | 0.000 | 0.013 | 0.033 | 0.047 | **0.073** |
| simple-built | **0.134** | 0.380 | 0.573 | 0.653 | 0.732 |

**The threshold is 0.25, not the midpoint of that gap.** The English stemmer is
not idempotent — `consider` stems to `consid`, `environment` to `environ`,
`geophys` to `geophi` — so a correct English vector always scores above zero,
and a short, vocabulary-dense one scores higher still. An adversarial test
fixture, correctly English-built but dense with proper nouns and technical
terms, reached **0.123**, which a threshold inside the measured gap would have
selected and destroyed. At 0.25 the margin is better than 2x and the cost is
one document: corpus-wide, dev has 403 documents at or above 0.12 and 402 at or
above 0.25.

Everything between 0.12 and 0.25 is a grey zone and is deliberately not
repaired — one document on each database. Missing a handful of broken documents
is recoverable; destroying correct ones is not.

### Documents with no index at all

Measured incidentally and worth recording: **8,936 of 20,639 prod documents
(43%) hold an empty `tsvector`**. Extraction produced nothing for them —
`azlibAdd/text_extractor.js` has `pdf-parse` commented out and falls back to
textract, which returns nothing for a scanned page with no text layer. Those
documents are invisible to full-text search regardless of configuration, and
no amount of re-indexing changes that. This is a larger hole in the search than
the defect this change fixes, and it needs OCR rather than SQL. Out of scope
here; recorded as a follow-up.

### What the repair cannot recover

`tsvector` positions are capped at 16,383; words beyond that are silently
clamped. On prod, 5,135 of the 6,850 affected documents fall entirely below the
cap and reconstruct with their original word order. The other 1,715 reach it,
and beyond that point the stored vector does not record order at all.

For those tails, stemming is still corrected — every word is still indexed, and
single-term search works correctly — but word order is not restored, so phrase
queries spanning the tail stay unreliable. They are unreliable *today* for the
same reason: the clamping already happened at ingest, and no repair short of
re-extraction can undo it. The repair makes no document worse.

### Batching

`documents_ts_idx` is a GIN index over the column being rewritten, and the
affected rows carry large vectors. The repair commits in batches by
`document_id`, following `normalize-metadata-json`, which established the
pattern in this repo after a single-statement pass ran over 20 minutes without
completing.

## Risks

- **Reconstruction is lossy in ways beyond word order.** Original casing and
  punctuation are gone, so a token like `U.S.G.S.` was already reduced to
  whatever `simple` made of it and will be re-parsed from that. This affects
  how a few tokens split, not whether the document is findable. Re-extraction
  is the only route to a byte-faithful index, and is out of scope here.
- **The detector's blind spot.** Documents with no English stopwords go
  unrepaired, as described above. Verified as a residual count rather than
  assumed to be zero.
- **No backup of the previous vectors.** The column is derived data and the
  previous values are the broken ones, so there is nothing worth preserving.
  The migration follows `normalize-metadata-json` in snapshotting the affected
  rows anyway, because unlike the weighted-search column this repair *writes*
  to an existing populated column, and a snapshot is the only way to undo it.
