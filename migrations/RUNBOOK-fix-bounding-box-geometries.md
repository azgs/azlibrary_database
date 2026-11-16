# Runbook — fix-bounding-box-geometries against `azlibrary` (production)

Repairs 463 bounding boxes whose longitudes were stored with the wrong sign,
or whose coordinates were transposed — `east`/`west`, `north`/`south`, or, in
collection 27608, `east`/`south`.

Spec and design: `openspec/changes/fix-bounding-box-geometries/`.

Run the whole sequence against `devazlib` first. Everything below is written
for prod; substitute `devazlib` for `azlibrary` to rehearse.

## Credentials

`devazlib` and `azlibrary` live on the **same cluster endpoint** and differ
only by database name, so the database must always be named explicitly. The
migration refuses to run unless `current_database()` matches the `target_db`
passed on the command line — that guard, not the connection string, is what
stands between a dev run and a prod run.

Credentials are in `azlibrary_react/.env` (`PG_PROD_*`, `PG_DEV_*`). Do not
paste them into a terminal that logs history.

## 0. Expectations

| | dev (`devazlib`) | prod (`azlibrary`) |
| --- | --- | --- |
| Rule A — both longitudes sign-flipped | 456 | 456 |
| Rule B — east/west transposed | 5 | 5 |
| Rule C — east/south transposed | 0 | 1 |
| Rule D — west alone sign-flipped | 1 | 0 |
| Rule E — north/south transposed | 1 | 1 |
| **rows updated** | **463** | **463** |
| Rule A candidates excluded by the Arizona guard | 0 | 2 |
| Rows not intersecting Arizona, before | 470 | 765 |
| Rows not intersecting Arizona, after | 14 | 309 |
| Quarantine report rows | 9 | 10 |
| Repairs that move no geometry (transpositions) | 6 | 6 |

Runtime is a minute or two. Only 463 rows change, but the `UPDATE` scans every
row to evaluate the rules.

Two things are exercised on prod and **cannot be rehearsed on dev**, because
the records involved exist only on prod:

- **Rule C.** Collection 27608 is not on dev. Step 1's preflight is what
  proves the correction before any write: check 9 asserts the corrected box
  equals the Arizona state extent.
- **The Arizona guard.** Dev has 456 both-positive rows and selects all 456.
  Prod has 458 and must select 456, excluding collections 28135 (Papua New
  Guinea) and 28139 (Bosnia). Preflight checks 5 and 21 cover this.

## 1. Immediately before the run

Run the preflight. It is read-only and writes nothing.

```bash
psql -h "$PG_PROD_HOST" -U "$PG_PROD_USER" -d azlibrary -f migrations/preflight-fix-bounding-box-geometries.sql
```

Every `CHECK` row must read `PASS`. Compare the `INFO` rows against the table
above. **If any count differs, stop** — the data has moved since the change was
written, and the rules need re-deriving rather than re-running.

## 2. Run

```bash
psql -h "$PG_PROD_HOST" -U "$PG_PROD_USER" -d azlibrary -v target_db=azlibrary -v batch_size=2000 -f migrations/fix-bounding-box-geometries.sql
```

The final notice must read `done: 463 rows changed`.

Note that psql writes two spaces after `NOTICE:`; a `grep` for `NOTICE: done`
will silently match nothing.

The script backs up to `metadata.azgs_backup_geometry` in its own transaction
before touching anything: `geom` for every row, and `json_data` as well for the
463 rows it will repair.

## 3. Verify

```bash
psql -h "$PG_PROD_HOST" -U "$PG_PROD_USER" -d azlibrary -f migrations/verify-fix-bounding-box-geometries.sql
```

Every `CHECK` row must read `PASS`. Check 6 is the one that matters most: it
asserts `geom` equals the envelope of the stored bounding box on every row,
which is what proves the trigger did the recomputation and that nothing wrote
`geom` out of band.

Check 8 asserts every unrepaired row kept its geometry. Its counterpart,
check 9, asserts every repaired row's `json_data` changed — **not** that its
geometry moved, because Rules B and E exchange two endpoints and so yield the
same rectangle. Info row 14 counts those; expect 6.

This change is otherwise the mirror of `normalize-metadata-json`, where `geom`
had to be provably *unchanged*.

The script ends with the quarantine report.

## 4. Confirm idempotency and reclaim space

```bash
psql -h "$PG_PROD_HOST" -U "$PG_PROD_USER" -d azlibrary -v target_db=azlibrary -v batch_size=2000 -f migrations/fix-bounding-box-geometries.sql
```

Must report `done: 0 rows changed`.

```bash
psql -h "$PG_PROD_HOST" -U "$PG_PROD_USER" -d azlibrary -c 'VACUUM ANALYZE metadata.azgs;'
```

`ANALYZE` matters here: the GiST index `azgs_geom_idx` has 457 rows in new
locations — the 463 repaired less the 6 transpositions, which leave the
rectangle where it was — and the planner should see the new distribution.

## 5. Spot-check the live site

On `library.azgs.arizona.edu`, draw a map extent over Arizona and confirm that
previously missing records now appear. Useful samples:

- **Collection 17039** — Rule A, was in Inner Mongolia.
- **Collection 17303** — Rule B, `DGM-148`, Copperplate Gulch, Greenlee County.
- **Collection 27608** — Rule C, `Arizona Aqueous Chemistry`, now the full
  state extent.
- **Collection 1193** — Rule A on a degenerate point; confirm it is still a
  point and has not been expanded into a box.

## 6. Hand off the quarantine report

Send the report from step 3 to curation. These records were deliberately not
repaired; see `openspec/changes/fix-bounding-box-geometries/proposal.md`.

## Rollback

Restore `json_data` for the repaired rows. The trigger recomputes `geom` from
the restored values, so `geom` is not restored directly — the backup's `geom`
and `geom_wkt` columns are there to check against, not to restore from.

```sql
UPDATE metadata.azgs a
SET json_data = b.json_data
FROM metadata.azgs_backup_geometry b
WHERE a.collection_id = b.collection_id
  AND b.will_repair = true
  AND a.json_data IS DISTINCT FROM b.json_data;
```

Then re-run the verify script. The exhaustion checks (2 to 5) will report the
restored defects, which is the correct signal that the rollback took effect.

## Known and deliberately not addressed

- **14,599 degenerate points inside Arizona.** Confirmed correct by the data
  owner on 2026-11-16: these are point locations for mine records, not
  truncated extents. Protected by an explicit spec requirement.
- **~300 national and continental extents**, 292 of them `USGIN` AASG
  geothermal compilations, plus Special Paper chapters that are legitimately
  about Texas, Nevada, Utah and the Upper Midwest. Coarse, not wrong.
- **19 near-global extents** spanning the antimeridian. These are the only
  rows where a positive `east` is correct.
- **The producer.** Whatever writes absolute longitudes still does. This
  migration repairs stored data only; the defect will regrow until the
  producer change lands.
- **No `CHECK` constraint** was added. It belongs with the producer fix, and a
  naive one would reject the legitimate antimeridian extents.
