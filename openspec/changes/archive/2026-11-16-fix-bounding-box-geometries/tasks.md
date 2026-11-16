## 1. Preparation

- [x] 1.1 Profile `metadata.azgs` bounding boxes on `azlibrary` (prod) into
      mutually exclusive buckets, and record the counts in proposal.md.
- [x] 1.2 Confirm the Rule A and Rule B populations are identical on
      `devazlib` and `azlibrary`, so dev is a faithful rehearsal for the
      repairable rows.
- [x] 1.3 Confirm Rule A and Rule B share no rows on either database.
- [x] 1.4 Confirm the defects predate `normalize-metadata-json` by checking a
      sample against `metadata.azgs_backup_normalize`.
- [x] 1.5 Confirm `metadata.geom_trigger()` derives `geom` from
      `json_data->'bounding_box'` on every `UPDATE`, so the migration need not
      and must not write `geom`.
- [x] 1.6 Confirm with curation that the 14,599 degenerate points inside
      Arizona are intended point locations and not truncated extents.
      Confirmed correct by the data owner, 2026-11-16.

## 2. Preflight script

- [x] 2.1 Create `migrations/preflight-fix-bounding-box-geometries.sql` as a
      strictly read-only script, following the harness used for
      `normalize-metadata-json`: compute the corrected coordinates in a CTE
      chain and assert the spec against the computed output without writing.
- [x] 2.2 Assert Rule A selects exactly 456 rows and that every one of them
      intersects the Arizona envelope after correction.
- [x] 2.3 Assert Rule A selects neither of the two genuinely eastern-hemisphere
      `USGIN` records (collections 28135 and 28139, which exist on prod only),
      and no antimeridian-spanning extent. On prod this is a live test of the
      Arizona guard: 458 rows have both longitudes positive and 456 are
      selected. On dev there are only 456 candidates, so the guard excludes
      nothing and is not exercised.
- [x] 2.4 Assert Rule B selects exactly the 5 known rows and that each has both
      longitudes negative before correction.
- [x] 2.5 Assert Rule C selects exactly collection 27608 and that the corrected
      box matches the Arizona state extent.
- [x] 2.6 Assert the three rules are pairwise disjoint.
- [x] 2.7 Assert every corrected pair satisfies `west <= east`, and that no
      corrected record has a latitude outside ±90.
- [x] 2.8 Assert the count of rows whose coordinates are unchanged equals
      total rows minus 463, in each database.
- [x] 2.9 Assert Rule D selects only rows with `west` positive and `east`
      negative, and that each intersects Arizona after correction.
- [x] 2.10 Assert Rule E selects only rows with `south` greater than `north`,
      that the correction leaves `south <= north`, and that Rule E never
      coincides with Rule C.

## 3. Migration script

- [x] 3.1 Create `migrations/fix-bounding-box-geometries.sql` that aborts
      unless `current_database()` equals a `:target_db` variable passed on the
      command line, using the `set_config` / `current_setting` guard pattern —
      psql does not interpolate inside dollar-quoted strings.
- [x] 3.2a Name the batch loop's row-count variable `n_rows`, not `n`: the
      transform aliases the north coordinate as `n`, and plpgsql resolves a
      bare `n` to the variable, which makes the column reference ambiguous and
      aborts every batch.
- [x] 3.2 Add the backup step in its own transaction: create
      `metadata.azgs_backup_geometry` holding `collection_id`, pre-migration
      `geom` and `ST_AsText(geom)` for **every** row, and pre-migration
      `json_data` only for the rows a rule selects. Backing up every geometry
      is what makes the "untouched rows kept their geometry" assertion
      self-contained; carrying `json_data` for all of them would duplicate
      40 MB to no purpose. Insert only rows not already present, so a re-run
      preserves the original snapshot.
- [x] 3.3 Implement all five rules as a single `CASE` per coordinate inside
      one `UPDATE`, so no row is written twice and each row pays the trigger
      cost once. Rule E assigns only the latitudes, so it composes with a
      longitude rule instead of competing with one.
- [x] 3.4 Compute Rule A's corrected pair as
      `west := -greatest(abs(east), abs(west))`,
      `east := -least(abs(east), abs(west))`, so ordering is correct by
      construction.
- [x] 3.5 Key Rule C on `collection_id` **and** its exact stored coordinates,
      so a re-run is a no-op rather than a second transposition.
- [x] 3.6 Write `json_data` only. Issue no assignment to `geom`.
- [x] 3.7 Guard the `UPDATE` with
      `WHERE m.json_data IS DISTINCT FROM f.json_data`, so untouched rows are
      not rewritten and do not fire the triggers.
- [x] 3.8 Wrap the `UPDATE` in a `DO $batch$` loop over `metadata_id` ranges
      with a per-batch `COMMIT` and `RAISE NOTICE` progress, and a
      `:batch_size` variable passed on the command line.

## 4. Verification script

- [x] 4.1 Create `migrations/verify-fix-bounding-box-geometries.sql` with one
      row per assertion, following the format used for
      `normalize-metadata-json`.
- [x] 4.2 Assert no record has both longitudes positive with a negation that
      would land in Arizona.
- [x] 4.3 Assert no record has `west > east` except the antimeridian extents,
      and that every such row has a negative `west` and a positive `east`.
- [x] 4.4 Assert collection 27608's box is the Arizona state extent.
- [x] 4.5 Assert that for every row, `geom` equals
      `ST_MakeEnvelope(west, south, east, north, 4326)` computed from the
      stored `bounding_box` — the central assertion, that the two
      representations agree.
- [x] 4.6 Assert every row in `metadata.azgs_backup_geometry` that was not
      marked for repair has a `geom` spatially equal to its backed-up value.
      Do **not** assert the converse: Rules B and E exchange two endpoints,
      which yields the same rectangle wound the other way, so a transposition
      repair legitimately leaves `geom` spatially equal. Assert instead that
      every repaired row's `json_data` differs from its pre-image, and report
      the transposition count as INFO.
- [x] 4.7 Assert no backed-up row is missing from `metadata.azgs` — test that
      nothing was lost, not that the counts match, since records created while
      the migration runs are legitimate.
- [x] 4.8 Report as INFO the count of rows created during the run, and the
      count of rows that still do not intersect Arizona.
- [x] 4.9 Emit the quarantine report: the 10 implausible records (9 on dev) with
      `collection_id`, `series`, `title`, the four coordinates, and the reason
      each was not repaired.

## 5. Execution

- [x] 5.1 Write `migrations/RUNBOOK-fix-bounding-box-geometries.md` with
      ordered steps, the credentials note, the rollback statement, and the
      known exclusions.
- [x] 5.2 Run the preflight against `devazlib` and confirm every assertion
      passes.
- [x] 5.3 Run the migration against `devazlib`. Confirm 463 rows updated.
- [x] 5.4 Run the verification against `devazlib`. Confirm every assertion
      passes.
- [x] 5.5 Spot-check the dev web client's map search for a sample of repaired
      collections and confirm they now appear for an Arizona extent. Done
      against the live dev API (`dev.data.azgs.arizona.edu/api/v1`) with
      negative controls: collection 1193 (Rule A degenerate point) matches an
      Arizona box and no longer matches Mongolia; 17549 (Rule D) matches
      Arizona and no longer matches the mid-Atlantic, which its 220-degree
      box previously reached; 18698 (Rule E) matches the Gila Bend box.
- [x] 5.6 Run the preflight against `azlibrary` and confirm the counts match
      proposal.md.
- [x] 5.6a Confirm idempotency on `devazlib`: a second run reports 0 rows
      changed.
- [x] 5.6b `VACUUM ANALYZE metadata.azgs` on `devazlib`.
- [x] 5.7 Run the migration against `azlibrary`. Confirm 463 rows updated.
- [x] 5.8 Run the verification against `azlibrary`. All 11 checks pass; 463
      repaired, 0 rows created during the run, 6 pure transpositions, 309 rows
      still outside Arizona as predicted.
- [x] 5.8a Confirm idempotency on `azlibrary`: a second run reports 0 rows
      changed.
- [x] 5.8b Confirm the database guard aborts when `target_db` does not match
      `current_database()`.
- [x] 5.8c Spot-check the production API with negative controls: collection
      1193 matches an Arizona box and no longer matches Mongolia; 27608
      (Rule C, never rehearsed on dev) matches central Arizona and no longer
      matches the Red Sea, where its stored `east` of +31.13 used to reach;
      18698 (Rule E) matches the Gila Bend box.
- [x] 5.9 `VACUUM ANALYZE metadata.azgs` on `azlibrary` so the planner sees
      the new `geom` distribution. (Done on `devazlib` in 5.6b.)
- [x] 5.10 Hand the quarantine report to curation. Exported to
      `quarantine-azlibrary-2026-11-16.csv` (10 records, with `perm_id` so
      curators can open each one directly). The in-person curation of those
      records is out of scope by decision on 2026-11-16; the report is the
      deliverable.

## 6. Follow-ups

- [x] 6.1 Drop `metadata.azgs_backup_geometry` on both databases after release
      acceptance. Dropped 2026-11-16, together with the previous change's
      `metadata.azgs_backup_normalize`, after re-running both verification
      suites: geometry 11/11 PASS on each database, normalize 15/16 with its
      check 13 ("geom unchanged vs backup") reporting 457 — the 463 repaired
      less the 6 transpositions that leave the rectangle in place, which is
      this change deliberately superseding that invariant. About 96 MB
      reclaimed. Rollback is no longer possible.
- [x] 6.2 Update `azlibrary_database/README.md` to document that longitudes are
      signed and that `west <= east`. Done, and the surrounding format
      documentation was corrected against production at the same time: the
      license was still shown as `CC BY-NC-SA 4.0`, `private` as the string
      `"false"` rather than a boolean, `files[]` with a non-existent
      `extension`, a `doi` entry in `links[]` that does not exist, and
      `mine_data` omitted entirely.
- [~] 6.3 ~~Open a producer change: find and fix whatever writes absolute
      longitudes, and add a `CHECK` constraint rejecting a box with both
      longitudes positive.~~ Not doing: producer changes are out of scope by
      decision on 2026-11-16, consistent with the scope taken for
      `normalize-metadata-json`. **The defect will regrow as records are
      ingested**, and this change repairs stored data only. The migration,
      preflight and verification scripts are idempotent and can simply be run
      again.
- [~] 6.4 ~~Open a curatorial change for the 10 quarantined records.~~ Not
      doing: out of scope by decision on 2026-11-16. The records remain as
      found and are listed in the quarantine report, which
      `verify-fix-bounding-box-geometries.sql` reproduces on demand. Whether
      collections 15738 and 16615 share a recoverable reprojection error is
      left open in design.md.
