## Context

`metadata.azgs` already carries six `BEFORE INSERT OR UPDATE` row triggers: one
for `geom` and five for `tsvector` columns. Each tsvector trigger does
`drop table if exists tabletemp; CREATE TEMP TABLE ...; INSERT ...; EXECUTE ...`
**per row**. `migrations/README.md` already names the consequence — "the trigger
cost dominates any migration that touches many rows."

That cost shapes this design. A sixth trigger would make every ingest and every
future migration slower, and would need an artificial `UPDATE metadata.azgs SET
json_data = json_data` to backfill, firing all six triggers across every row.

## Goals

- One weighted vector per record, usable as a single `ts_rank_cd` score.
- Index `abstract`, which no current vector covers.
- No new per-row trigger, and no backfill pass.
- Zero behavioural change for anything reading the existing four vectors.

## Decisions

### Generated column rather than a trigger

`GENERATED ALWAYS AS (metadata.search_vector(json_data)) STORED` makes the
database responsible for the value. Ingest and the API's `PATCH` path both get
it for free without referring to the column, and it is impossible for a stored
vector to drift from the `json_data` it came from — a guarantee the trigger
approach only has by convention.

It also removes the backfill. `ALTER TABLE ... ADD COLUMN ... STORED` rewrites
the table, and that rewrite computes the column for every existing row. There
is no second pass and no window where the column is half-populated.

Requires Postgres 12 or later, for both generated columns and the `jsonpath`
machinery. `server-setup.txt` still documents a Postgres 10 apt install; that
file predates the move to RDS and has not been corrected. The version is
asserted by the migration rather than assumed, and reported by the preflight.

### A named function rather than an inline expression

The expression is twenty-odd lines. Inlining it into the `ALTER TABLE` makes
the DDL unreadable and makes the fresh-install schema and the migration two
copies of the same logic that can drift. `metadata.search_vector(jsonb)` is
written once and referenced from both.

The cost is a sharp edge worth stating plainly: **Postgres does not recompute a
generated column when the function behind it changes.** `CREATE OR REPLACE
FUNCTION` on `search_vector` will silently leave every existing row holding a
vector built by the old definition, with no error and no warning. Any change to
the weights or the field list must therefore be followed by dropping and
re-adding the column, which is another full rewrite. The migration header says
this, and the verify script detects it by recomputing the function over every
row and comparing against the stored value.

### Drop and re-add rather than convert in place

Postgres before 18 has no way to turn an existing plain column into a stored
generated one. `kitchensink_search` must be dropped and re-added.

This is safe only because the column is empty on every row, which is the state
it has been in since the schema was written. The migration does not take that
on trust: it aborts if it finds any row where `kitchensink_search` is non-null
and non-empty, rather than dropping data on the assumption that nobody ever
populated it.

Dropping the column also drops `azgs_kitchensink_idx`, which the migration
recreates.

### Weights

| Weight | Field | Rationale |
| --- | --- | --- |
| `A` | `title` | What the item is called; the strongest single signal, and what users type. |
| `B` | `keywords[].name` | Deliberately assigned vocabulary, high precision but broader than a title. |
| `C` | `authors[].person`, `series` | Strong when matched deliberately, noisy otherwise — surnames collide with place names across this corpus. |
| `D` | `abstract` | Highest recall, lowest precision; a term appearing only here is a weak signal on its own. |

These come from what the fields mean, not from measurement. `ts_rank_cd`'s
default weights (`{0.1, 0.2, 0.4, 1.0}` for D through A) then give a title hit
ten times the contribution of an abstract hit. Whether that ratio is right for
this corpus is a tuning question for after there is query telemetry; the point
of this change is that the ratio becomes expressible at all.

### Determinism of the aggregated fields

`keywords[].name` and `authors[].person` are aggregated with `string_agg`,
which has no defined order unless one is given. Unordered, two rewrites of the
same row could produce vectors with the same lexemes at different positions,
and `ts_rank_cd` is position-sensitive. Both aggregates therefore use
`jsonb_array_elements(...) WITH ORDINALITY` and `ORDER BY` that ordinality, so
the function is deterministic in the way `IMMUTABLE` claims it is.

### Explicit text search configuration

Every `to_tsvector` call names `pg_catalog.english`. The two-argument form is
`IMMUTABLE`; the one-argument form is only `STABLE`, because it reads the
`default_text_search_config` GUC — so the generated column could not use it
even if we wanted to.

This matters beyond the type system, and measurement turned a suspicion into a
confirmed live defect. `azlibAdd/documents.js` inserts document text with the
one-argument form, so `documents.documents.text_search` is stemmed according to
whatever the server default happened to be at ingest time, while the API always
queries it with `plainto_tsquery('pg_catalog.english', ...)`.

`default_text_search_config` is **`pg_catalog.simple`** on both servers, and
the stored document corpus was mixed because it has not always been. That was
a live defect in `documents.documents.text_search`, not in anything this change
touches, and it has since been fixed and deployed on its own branch —
`fix-document-search-config`, merged as #101. Both databases were repaired on
2026-11-16: **628 documents across 454 collections on prod**, 402 across 278
on dev.

Two corrections are worth recording here, because this document carried both
wrong figures at different times. The defect was first sized with seven
hand-picked stopwords (1,142 documents on prod), then re-sized with the full
127-word English stop list (6,850), and the second number was presented here as
a six-fold correction of the first. **That was backwards.** The stopword test
is invalid in either form: the stopword filter runs on the token *before*
stemming, so an ordinary word whose stem equals a stopword puts that stopword
into a perfectly correct English vector — "owned" gives `own`, "mostly" gives
`most`. On dev, `own` appears in 3,152 of 11,007 definitively English-built
documents. The 127-word list overcounted by roughly eleven times, and applying
it rewrote 6,637 correct rows on dev before being rolled back from its
snapshot.

The working detector scores each document by the fraction of its lexemes that
change under English stemming — `simple` stores raw words, `english` stores
stems. See that change's design for the thresholds.

What matters for *this* change is only that the new vector cannot join the
problem: every `to_tsvector` call behind `kitchensink_search` names
`pg_catalog.english` explicitly, so it is independent of server configuration
by construction.

### No backup table

`migrations/README.md` requires that scripts touching `metadata.azgs` snapshot
affected rows first. This migration deliberately does not, and the header says
so: it writes no row, modifies no `json_data`, and the column it adds is
derived. Rollback is `DROP COLUMN kitchensink_search`, after which the database
is in exactly its pre-migration state. A snapshot would duplicate 24,000 rows
of jsonb to protect against nothing.

## Alternatives considered

- **Expression index, no column.** `CREATE INDEX ... ON metadata.azgs USING gin
  (metadata.search_vector(json_data))` avoids the rewrite and stores nothing
  extra. Rejected: every query would have to repeat the exact expression
  textually for the planner to match it, and `ts_rank_cd` would recompute the
  vector per candidate row rather than reading it.
- **A sixth trigger.** Consistent with the existing five, and works below
  Postgres 12. Rejected on the per-row cost above, and because it needs a
  backfill that fires all six triggers over every row.
- **Separate search table.** Clean separation, no rewrite of `metadata.azgs`.
  Rejected as more moving parts than a 24,000-row problem justifies.
- **One unweighted vector over concatenated text.** Simpler, and roughly what
  `kitchensink` was presumably going to be. Rejected: it would index the
  abstract, which is most of the benefit, but leave relevance exactly as
  undifferentiated as it is now.

## Risks

- **Rewrite under `ACCESS EXCLUSIVE`.** Measured at 158 MB / 23,003 rows on dev
  and 162 MB / 23,898 rows on prod. Expect tens of seconds: the rewrite calls
  `search_vector` once per row and fires no triggers, unlike the
  `normalize-metadata-json` pass that took 15m27s because each row fired six.
  It is still a full-table lock and the API blocks behind it.
- **Version floor.** Settled: both servers are PostgreSQL 14.22, comfortably
  above the floor. The migration still aborts below 12 rather than failing
  halfway.
- **Silent staleness after a function change.** Described above. The verify
  script is the detector; run it after any change to `search_vector`.
- **Citation boilerplate now lives in `abstract`, and the `D` component indexes
  it.** This postdates the first draft of this design. `normalize-metadata-json`
  retires `journal` by appending its citation boilerplate to the record's
  `abstract` rather than discarding it, which is the right call for data
  preservation but puts near-identical text into the field this change indexes.
  Measured after normalize, now on both databases: **5,331 abstracts contain
  "Please cite by using"** — 23% of dev's 22,913 non-blank abstracts and 22.4%
  of prod's 23,811 — and an English query for `cite` matches 5,339 collections
  on each.

  At weight `D` a boilerplate hit contributes a tenth of a title hit, so it
  cannot outrank a genuine match, and the affected words (`cite`, `item`,
  `description`) are not terms anyone searches a geological library for. The
  assessment is that this is tolerable for a *ranked* search and would not be
  for a *filter*. Three options if it proves otherwise: strip a known
  boilerplate prefix inside `search_vector` before indexing; move the
  boilerplate to a non-indexed field; or drop `abstract` to a fifth weight,
  which PostgreSQL does not offer. No action taken for now — this is recorded
  so the decision is deliberate rather than accidental, and so that anyone
  puzzled by 5,000 collections matching "cite" finds the explanation here.

- **Shape dependence on `normalize-metadata-json`.** `series` is stored
  inconsistently and `keywords[].name` carries untrimmed whitespace on most
  rows today. The function handles both, but running normalize first produces a
  cleaner vector and avoids rebuilding it later.
