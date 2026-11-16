## Context

See proposal.md — Why. Two constraints shape the approach.

First, every `UPDATE` to `metadata.azgs` fires six `BEFORE INSERT OR UPDATE`
row triggers (`geom_trigger`, `title_trigger`, `author_trigger`,
`keyword_trigger`, `series_trigger`, `collections_trigger`). Each one creates
and drops a single-row `TEMP TABLE` per row to read `new.json_data`. The
derived columns cannot be updated independently of `json_data`, and the
per-row trigger cost dominates the migration.

Second, `devazlib` and `azlibrary` are two databases on one RDS cluster,
reachable at the same host and port and differing only by database name. A
script that relies on an ambient connection can silently hit the wrong one.

## Goals / Non-Goals

Goals:
- One idempotent, re-runnable transformation that can be applied to `devazlib`,
  verified, then applied unchanged to `azlibrary`.
- A verifiable before/after claim for every requirement in the spec.
- A rollback that restores `json_data` exactly, including derived columns.

Non-Goals:
- Changing any trigger, index or table definition.
- Changing producer code (see proposal.md — Impact).
- Deciding the fate of test and placeholder records.

## Decisions

**Single-pass UPDATE over one pass per defect.** Nine separate statements
would re-fire six triggers per row nine times. One `UPDATE` that composes all
transforms into a single `jsonb` expression pays the trigger cost once.
Alternative considered: one statement per defect, for easier debugging —
rejected on cost, since each pass rewrites all 23,003 rows and recomputes six
derived columns.

**Plain SQL script run with `psql`, not a Node migration.** The repo's Node
tooling (`azlibAdd`, `azlibConvert`) is for ingest, not schema or data
migration, and there is no migration runner to extend. A SQL file is
reviewable as the exact statement that will run against production, and `psql`
takes the target database as an explicit argument. Alternative considered: a
`pg-promise` script matching the existing style — rejected because it adds a
layer between review and execution without benefit for a one-shot migration.

**Idempotent transforms.** Each transform is written so that applying it to an
already-normalized record is a no-op: casts are guarded by `jsonb_typeof`,
trims are unconditional, the license object is assigned rather than patched.
Re-running the script after a partial failure is therefore safe, and the
script can be run against prod even if some rows were fixed by other means.

**Transform order within the single pass.** Keyword normalization is ordered:
trim names, then drop empties, then collapse `time` to `temporal`, then
de-duplicate on `(name, type)`. Collapsing before de-duplicating is required —
a record holding both `{1920s, time}` and `{1920s, temporal}` only becomes a
detectable duplicate after the collapse.

**Backup table, not `pg_dump`.** The migration writes
`metadata.azgs_backup_normalize` holding `collection_id`, the pre-migration
`json_data` and the pre-migration `geom` for every row. Rows already present
are not re-inserted, so re-running preserves the original snapshot. Restoring is then an `UPDATE ... FROM` that re-fires
the triggers and rebuilds `geom` and the tsvectors from the restored JSON,
which a file-level dump would not do without a full table reload.

**`geom` equality is the migration's correctness check.** `geom_trigger`
already casts the bounding box with `cast(... as float)`, which accepts both
the string and number forms and tolerates the leading whitespace. Normalizing
coordinate types must therefore leave `geom` spatially identical, and any row
where it does not is a bug in the transform. This is a strong, cheap assertion
over all 23,003 rows.

## Risks / Trade-offs

- **Per-row trigger cost makes the single `UPDATE` long-running, holding a
  `ROW EXCLUSIVE` lock on a table the API reads and writes.** → Time the run
  on `devazlib` first. If it exceeds an acceptable window, batch by
  `collection_id` range in separate transactions; the transforms are
  idempotent, so a batched run is equivalent to a single pass.
- **`keyword_search` and `author_search` tsvectors change for rows whose
  keywords are trimmed or de-duplicated.** → This is intended, not a
  regression, but it means tsvector equality cannot be used as a correctness
  check the way `geom` equality can. Verify instead that keyword *search
  results* for a sample of trimmed terms are a superset of the pre-migration
  results.
- **Rewriting every row doubles the table's heap until vacuumed.** → `VACUUM
  (ANALYZE) metadata.azgs` after the run; the table is 23,003 rows, so the
  cost is small relative to the 394 GB database.
- **Relicensing is externally visible.** The new terms propagate to the
  `/metadata` API, the ISO 19139 export and any downstream harvester. →
  Out of this change's control, but call it out at rollout so consumers are
  not surprised by a license string change.
- **Running against the wrong database.** → The script takes no ambient
  connection: it is invoked as `psql -d <database>` and its first statement
  asserts `current_database()` matches an expected value passed as a variable,
  aborting otherwise.

## Migration Plan

1. Re-profile `azlibrary` with the same inventory queries used on `devazlib`.
   Prod counts will differ and the script must be shown to cover prod's actual
   value shapes, not dev's.
2. On `devazlib`: create the backup table, run the migration in one
   transaction, run the verification suite.
3. Compare `geom` against the backup for all rows; investigate any difference
   before proceeding.
4. Spot-check the React client and the `/metadata` API against dev, in
   particular year-range filtering, map extent search and keyword filtering.
5. On `azlibrary`: repeat steps 2–4 in a maintenance window.
6. `VACUUM (ANALYZE) metadata.azgs` on both.
7. Keep the backup tables until the next release is accepted, then drop them.

Rollback: `UPDATE metadata.azgs m SET json_data = b.json_data FROM
metadata.azgs_backup_normalize b WHERE m.collection_id = b.collection_id AND
m.json_data IS DISTINCT FROM b.json_data`, which restores the JSON and lets the
triggers rebuild every derived column.

## Consumer Compatibility

Checked against `azlibrary_api` and `azlibrary_react` before the dev run. No
consumer change is required by this migration, with one exception noted below.

- **Numeric `year` is accepted on write.** `collections.routes.js` validates
  with `/^\d{4}$/.test(target.year)`, and `.test()` coerces a number to its
  string form, so a numeric year passes unchanged.
- **Numeric `year` is accepted on read.** Every query path extracts it with
  `json_data->>'year'`, which returns text regardless of the stored JSON type,
  so range filters, exact matches and the `ORDER BY` in `metadata.model.js`
  behave identically. The `when json_data->>'year' = '' then null` guard
  becomes dead code but stays harmless.
- **Numeric bounding box coordinates are accepted on write and read.**
  Validation uses `Number()` / `parseFloat()`, the ISO 19139 export writes them
  into `gco:Decimal` elements where a number is the more correct form, and
  `Item.js` passes them straight to Leaflet, which prefers numbers to strings.
- **`journal` has no consumer.** The API never reads it, and the webclient's
  `journal` variable in `Metadata.js` is actually `collection_group.name`, so
  changing the bare string to an object affects nothing that is rendered today.
- **The license row appears on nine more records.** `Item.js` renders the
  license only when both `license.url` and `license.type` are present, so the
  nine rows with a blank or absent license begin displaying it.
- **Keyword group headings change for `time` records.** `Keywords.js` groups by
  the raw type string, so affected records will show a `temporal` heading in
  place of `time`. This is the intended **BREAKING** change.

One regression this migration introduces:

- **`Metadata.js` will export `PY - null` for blank years.** The RIS and
  EndNote exports build the year line by string concatenation
  (`'PY - ' + collection.metadata.year`). Today a blank year is `""` and
  produces `PY - `; after normalization it is `null` and produces `PY - null`.
  This affects the 44 records with no year, in the citation export only. The
  fix belongs in the webclient, not in the stored data, and should be a
  one-line guard in `azlibrary_react`.

## Open Questions

None outstanding. The question of whether the API tolerates the normalized
shapes is resolved under Consumer Compatibility above.
