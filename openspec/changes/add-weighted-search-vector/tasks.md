## 1. Scripts

- [x] 1.1 Add `metadata.search_vector(jsonb)`: an `IMMUTABLE`, `PARALLEL SAFE`
      SQL function returning a weighted `tsvector` — `A` title, `B`
      `keywords[].name`, `C` `authors[].person` + `series`, `D` `abstract`.
      Every `to_tsvector` call names `pg_catalog.english` explicitly, and both
      aggregates order by `WITH ORDINALITY` so the function is deterministic.
- [x] 1.2 Create `migrations/add-weighted-search-vector.sql`: aborts unless
      `current_database()` equals `:target_db`; aborts below PostgreSQL 12;
      aborts if `kitchensink_search` holds a value on any row; drops and
      re-adds the column as `GENERATED ALWAYS AS (...) STORED`; recreates
      `azgs_kitchensink_idx`; runs `ANALYZE`.
- [x] 1.3 Make the migration idempotent: a second run detects
      `is_generated = 'ALWAYS'`, reports it, and changes nothing.
- [x] 1.4 Document the staleness trap in the migration header — `CREATE OR
      REPLACE FUNCTION` does not recompute a generated column — with the
      drop-and-re-run recipe for rebuilding after a weight change.
- [x] 1.5 Create `migrations/preflight-add-weighted-search-vector.sql`:
      read-only, inlines the vector expression so it needs no function, reports
      server version, `default_text_search_config`, table size, per-field
      coverage, and the number of rows that gain a lexeme no current per-field
      vector holds.
- [x] 1.6 Create `migrations/verify-add-weighted-search-vector.sql`: one row
      per spec assertion, all violation counts zero, including a staleness
      detector that recomputes the function over every row.
- [x] 1.7 Update `azlibConfigPG/schemas/02-metadata.sql` so a freshly built
      database comes out in the migrated shape: function defined before the
      table, column declared generated.

## 2. Local verification

Run against a throwaway PostgreSQL 17 database built from
`01-public.sql` + the pre-change `02-metadata.sql`, seeded with records
covering: every field populated; title only; no searchable field at all;
`series` as an object; abstract only; and a term appearing in an abstract and
nowhere else.

- [x] 2.1 Preflight reports PASS on all four CHECK rows against the
      pre-migration schema.
- [x] 2.2 Migration applies cleanly; the `DO` block reports replacing an empty
      column.
- [x] 2.3 Verify reports PASS on all ten assertions.
- [x] 2.4 Re-running the migration reports "already a generated column" and
      changes nothing.
- [x] 2.5 Wrong `target_db` aborts before any DDL runs.
- [x] 2.6 Weighting is real: a term in a title ranks `1.0000` where the same
      term in an abstract ranks `0.1000` under `ts_rank_cd`.
- [x] 2.7 An abstract-only term matches the new vector and matches none of the
      four existing per-field vectors.
- [x] 2.8 Updating `json_data` updates the vector in the same statement, with
      no reindex step.
- [x] 2.9 A direct write to `kitchensink_search` is rejected by the server.
- [x] 2.10 Changing `metadata.search_vector()` leaves stored values stale, and
      verify assertion 4 catches it.
- [x] 2.11 A database built from the updated `02-metadata.sql` alone passes all
      ten verify assertions, so the fresh-install and migrated shapes agree.

## 3. Rollout

- [x] 3.1 Run the preflight against `devazlib` and record the real numbers in
      proposal.md and design.md. All four CHECK rows PASS. 23,003 rows, 158 MB,
      22,913 non-blank abstracts, 22,627 rows (98.4%) gaining a lexeme no
      current per-field vector holds.
- [x] 3.2 Run the preflight against `azlibrary` (prod). All four CHECK rows
      PASS. Re-run 2026-11-16 after `normalize-metadata-json` landed on prod:
      23,898 rows, 162 MB, 23,811 non-blank abstracts, 23,201 rows (**97.1%**)
      gaining a lexeme. The earlier run recorded 18,479 abstracts and 74.8%;
      normalize moving `journal` boilerplate into `abstract` accounts for the
      whole difference, and prod now matches dev.
- [x] 3.3 If either server is below PostgreSQL 12, stop. Both are **PostgreSQL
      14.22**; the design applies.
- [x] 3.4 Decide whether `normalize-metadata-json` lands first. Resolved: it
      has now run on **both** databases and been archived. Verified 2026-11-16
      on each: zero string `year` values, zero bare `journal` strings, zero
      untrimmed `keywords[].name`, and its backup tables dropped. The vector
      will therefore be built over normalized shapes on both, which was the
      prerequisite.
- [x] 3.5 Applied to `devazlib` 2026-11-16. Preflight: all four CHECK rows
      PASS. The table rewrite took **14 seconds** over 23,003 rows / 158 MB.
      Verify reports **10 of 10 assertions PASS** against real data, including
      the staleness detector and the check that every abstract lexeme now
      appears in the vector.
- [x] 3.5a Citation-boilerplate noise checked on dev and **it does not
      interfere**. For `grand canyon`, 120 records match and 21 of them carry
      "Please cite by using" — but the best-ranked boilerplate record sits at
      **position 37**, below every genuine hit. Weight `D` does what it was
      chosen to do. No need for the remedies in design.md; leaving the
      boilerplate indexed.
- [x] 3.6 Ranking spot-checked on dev against real records. The top six for
      `grand canyon` are all title matches, led by "The Redwall Limestone",
      "Grand Canyon Stratigraphy" and "Breccia-pipe Uranium Mining in the Grand
      Canyon Region". Across the corpus for `copper`, the 1,222 records
      matching in the title score 1.0000-5.0000 while the 8,731 matching
      elsewhere score 0.1000-2.4000 — the weighting separates the two
      populations on real data as designed.
- [ ] 3.7 Apply to `azlibrary` in a quiet window, then run verify.

## 4. Follow-ups (not this change)

- [ ] 4.1 `azlibrary_api`: add a ranked `q` parameter reading
      `kitchensink_search`, fix the `ORDER BY` precedence bug in
      `metadata.model.js` (ranks are prepended, so query-string order decides
      sort priority), and replace `sum(ts_rank_cd(...))` over
      `documents.documents` with `max()` or a length-normalized `sum()`.
- [x] 4.2 `azlibAdd/documents.js` indexed document text with a config-less
      `to_tsvector()`, taking the server's `default_text_search_config`
      (`pg_catalog.simple`) while the API queries as `english`. **Done**, on
      its own branch: `fix-document-search-config`, merged as #101, deployed to
      both hosts 2026-11-16. Both databases repaired — 628 documents across 454
      collections on prod, 402 across 278 on dev. Note that the figures this
      change's design once carried for that defect (1,142, then 6,850) were
      both wrong; the stopword-based detector behind them is invalid, and the
      corrected count is in that change.
- [ ] 4.3 `azlibConfigPG/schemas/01-public.sql` cannot build a database from
      scratch: `lineage` and `lineage_removed` (lines 87 and 94) reference
      `collections`, which is not created until line 103. Found while building
      the test database for this change; unrelated to it, but it means
      `azlibConfigPG` is currently broken for new installs.
- [ ] 4.4 `metadata.keyword_trigger()` raises `cannot extract elements from an
      object` when `keywords` is not an array, so such a record cannot be
      inserted at all. `metadata.search_vector()` tolerates the shape; the
      trigger does not. Worth aligning when the five per-field triggers are
      converted to generated columns.
- [ ] 4.5 Retire the five per-field tsvector triggers in favour of generated
      columns, removing the per-row temp-table churn that `migrations/README.md`
      already identifies as dominating migration cost.
