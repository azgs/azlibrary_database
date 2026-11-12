## 1. Preparation

- [x] 1.1 Add a `migrations/` directory to the repo with a short README stating
      that migrations are plain SQL run with `psql -d <database> -f <file>`, and
      that `devazlib` and `azlibrary` share a host so the database must always
      be named explicitly.
- [x] 1.2 Add a `.gitignore` covering `.env`, and confirm no credentials are
      already tracked in git history.
- [x] 1.3 Run the inventory queries against `azlibrary` (prod) and record the
      counts alongside the dev counts in proposal.md, so the script is known to
      cover prod's actual value shapes.
- [x] 1.4 Confirm against dev whether the AZLib API accepts a numeric `year`
      and an object `journal` on read and write (design.md — Open Questions).

## 2. Migration script

- [x] 2.1 Create `migrations/normalize-metadata-json.sql` that aborts unless
      `current_database()` equals a `:target_db` variable passed on the command
      line.
- [x] 2.2 Add the backup step: create `metadata.azgs_backup_normalize` holding
      `collection_id`, pre-migration `json_data` and pre-migration `geom` for
      all rows. Insert only rows not already present, so a re-run preserves the
      original snapshot rather than overwriting it with migrated rows.
- [x] 2.3 Implement the bounding-box transform: for each of `north`, `south`,
      `east`, `west`, when the value is a JSON string, trim it and store it as a
      JSON number; leave existing numbers untouched.
- [x] 2.4 Implement the `year` transform: a numeric string becomes a JSON
      number, an empty or whitespace-only string becomes `null`, existing
      numbers and nulls are untouched.
- [x] 2.5 Implement the `journal` transform: a bare string becomes
      `{name: <string>, publisher: null, url: null}`; existing objects are
      untouched.
- [x] 2.6 Implement the keyword transform in order — trim `name`, drop entries
      whose trimmed name is empty, rewrite `type` `time` to `temporal`, then
      de-duplicate on `(name, type)` keeping first occurrence and preserving
      order.
- [x] 2.7 Implement the `mine_data.collection` trim and the `links[].name`
      canonicalization to `AZGS old` / `UA Library`, preserving each link's
      `url`.
- [x] 2.8 Implement the key renames: `informalname` to `informal_name` and
      `author` to `authors`, preserving values, removing the misspelled key, and
      never overwriting a correctly spelled key that is already present. No row
      is deleted.
- [x] 2.9 Implement the license assignment: set `license` to
      `{"type": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/"}`
      on every row, including rows whose `license` is currently blank or absent.
- [x] 2.10 Compose 2.3–2.9 into one `UPDATE`, applied in committed batches of
      `:batch_size` rows by `metadata_id`. A single-statement pass over the
      whole table was measured at over 20 minutes without completing, so
      batching is required rather than optional.
- [x] 2.11 Add `migrations/preflight-normalize-metadata-json.sql`: the same
      transform run read-only as a pure expression, asserting the spec against
      its computed output without writing or firing triggers.

## 3. Verification suite

- [x] 3.1 Create `migrations/verify-normalize-metadata-json.sql` with one query
      per spec requirement, each returning a violation count that must be zero.
- [x] 3.2 Add the `geom` assertion: every row's `geom` is spatially equal
      (`ST_Equals`, with both-null treated as equal) to its value in
      `metadata.azgs_backup_normalize`.
- [x] 3.3 Add a row-count assertion that `metadata.azgs` still holds the same
      number of rows as the backup table, since this change deletes nothing.
- [x] 3.4 Add a keyword-search check: for a sample of terms that were stored
      untrimmed, confirm post-migration results are a superset of the
      pre-migration results.

## 4. Dev run

- [x] 4.1 Run the migration against `devazlib`, recording wall-clock time.
      Result: 23,003 rows in 15m27s at `batch_size=500`. A second run changed
      0 rows in 8s, which confirms idempotency and shows the per-row trigger
      work — not the transform — accounts for essentially the whole runtime.
- [x] 4.2 Run the verification suite against `devazlib`; every check returns
      zero violations. All 16 assertions PASS, including `geom` equality
      against the backup.
- [x] 4.3 If the run time is unacceptable for a production window, add
      `collection_id` range batching and re-verify on dev.
- [x] 4.4 Exercise the React client and `/metadata` API against dev. Done
      against the deployed dev stack (dev.library, dev.mininginfo, dev.data),
      which already points at `devazlib`; no local environment was needed.
      Confirmed on `ADMM-1571694800017-549`: the API returns `year: null`,
      `license` CC BY-SA 4.0 with the non-deed URL, an empty `journal` object,
      numeric bounding box coordinates, `informal_name` present with no
      `informalname`, and trimmed keywords. The item page renders the license
      and groups keywords under Temporal; the empty year renders as blank
      rather than "null". Against the database, the API's own year-range and
      exact-year SQL returns results identical to the pre-migration backup,
      and exact keyword matching on `mineral resources` improved from 799 rows
      to 12,366.
- [x] 4.6 **Regression fixed in `azlibrary_react`.** The RIS and EndNote
      exports in `components/presentation/Metadata.js` built their year line by
      string concatenation, so a null year yielded `PY - null` / `%D null`
      where it previously yielded `PY - ` / `%D `. Both now coalesce with
      `?? ''`, restoring the pre-migration output for the 44 null-year records
      and leaving records with a year byte-identical. The change is committed
      to neither repo and is not yet deployed to dev.
      Still open, pre-existing and untouched: the same two functions print
      "null" for a null `series` (`VL - ` / `%V `), which affects roughly 5,400
      records per database and predates this change.
- [x] 4.5 `VACUUM (ANALYZE) metadata.azgs` on `devazlib`. Table 158 MB,
      backup table 40 MB.

## 5. Production run

- [x] 5.0 Prepare the prod run: `migrations/RUNBOOK-normalize-metadata-json.md`
      carries the ordered commands, expected timings, verification, rollback
      and the known exclusions. Prod re-profiled 2026-11-12 and unchanged
      from the earlier reading (23,897 rows, 17,148 string years, 45
      `informalname`, max collection_id 32687). Read-only pre-flight against
      live prod data: 17/17 PASS, 23,897 rows would be rewritten.
- [ ] 5.1 Schedule a maintenance window and notify consumers that the license
      string in `/metadata` and the ISO 19139 export changes from
      `CC BY-NC-SA 4.0` to `CC BY-SA 4.0`.
- [ ] 5.2 Run the migration against `azlibrary`. Budget roughly 16-17 minutes
      at `batch_size=500`, scaling dev's 15m27s by prod's 23,897 rows, and
      expect it to vary with cluster load.
- [ ] 5.3 Run the verification suite against `azlibrary`; every check returns
      zero violations.
- [ ] 5.4 `VACUUM (ANALYZE) metadata.azgs` on `azlibrary`.
- [ ] 5.5 Spot-check the production site for the same four behaviors as 4.4.

## 6. Cleanup and follow-up

- [ ] 6.1 After the release is accepted, drop
      `metadata.azgs_backup_normalize` on both databases.
- [ ] 6.2 Update the official metadata format in `README.md` to state the types
      this change establishes and the new license, and note where it currently
      disagrees with reality (`private` shown as a string, `files[].extension`,
      the `doi` link entry, and the undocumented `mine_data` object).
- [ ] 6.3 Open a follow-up change for the producer fixes listed in
      proposal.md — Impact, covering `azlibConvert`, `azlibAdd`,
      `azlibContriveMineCollections` and the API repository.
- [ ] 6.4 Open a follow-up change for the deferred content questions: test and
      placeholder records, always-null `identifiers.doi` and
      `identifiers.collection_id`, missing `collection_group.id`, and
      near-duplicate `collection_group.name` values.
