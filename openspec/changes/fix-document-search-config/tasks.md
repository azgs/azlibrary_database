## 1. Measure

- [x] 1.1 Establish that `default_text_search_config` is `pg_catalog.simple` on
      both servers, and that every other tsvector write and every API query
      names `pg_catalog.english` explicitly — so the defect is one call site.
- [x] 1.2 Build a complete detector. A vector holding any of PostgreSQL's 127
      English stopwords was not built with `english`. Abbreviated lists report a
      floor, not a count: 7 stopwords find 1,144 documents on prod, 21 find
      3,376, the full 127 find **6,850**.
- [x] 1.3 Count the damage. Prod: 6,850 of 20,639 documents (33%) across 5,957
      collections (25% of all collections). Dev: 6,637 of 20,019 across 5,792.
- [x] 1.4 Confirm word order is reconstructable from stored positions, and
      measure the position-cap split: on prod, 5,135 fully recoverable, 1,715
      at the 16,383 cap with tails already lost at ingest.
- [x] 1.5 Establish that a blanket repair is unsafe. Reconstructing an
      already-English vector does not round-trip: of 200 sampled correct
      documents, **0** came out identical and only 14 kept the same lexeme set.
      The repair must be strictly targeted.

## 2. Code

- [x] 2.1 Pin the configuration in `azlibAdd/documents.js`: index with
      `to_tsvector('pg_catalog.english', ...)`, with a comment recording why
      the explicit argument must stay.

## 3. Scripts

- [x] 3.1 `migrations/fix-document-search-config.sql`: aborts unless
      `current_database()` matches `:target_db`; snapshots affected rows into
      `documents.documents_backup_tsconfig`; repairs in committed batches by
      `document_id`; `ANALYZE`s afterwards.
- [x] 3.2 `migrations/preflight-fix-document-search-config.sql`: read-only,
      reports the configuration, the damage, the position-cap split, and proves
      on live data how many documents become findable.
- [x] 3.3 `migrations/verify-fix-document-search-config.sql`: one row per spec
      assertion, plus an informational count of the detector's blind spot
      rather than a claim that it is empty.
- [x] 3.4 `migrations/RUNBOOK-fix-document-search-config.md`, matching the two
      existing runbooks.

## 4. Local verification

Against a throwaway database built from `01-public.sql` + `06-documents.sql`,
seeded with two documents indexed under `simple` and one — identical text —
indexed under `english`.

- [x] 4.1 Preflight identifies exactly the 2 broken documents and reports the
      correct one as untouchable.
- [x] 4.2 Migration repairs 2 documents.
- [x] 4.3 Verify reports PASS on all six assertions.
- [x] 4.4 **The repaired vectors come out byte-identical to the
      correctly-indexed document**, which is the strongest available evidence
      that reconstruction is faithful.
- [x] 4.5 The already-correct document is byte-identical to its original.
- [x] 4.6 All five inflected terms (`geology`, `mapping`, `mines`, `faulting`,
      `resources`) match all three documents afterwards; two of three were
      unreachable before.
- [x] 4.7 A second run repairs 0 documents.
- [x] 4.8 A wrong `target_db` aborts before any write.

## 5. Detector rework (done — the first selector was wrong)

- [x] 5.0a The stopword selector was invalid: the stemmer can emit a lexeme
      that is itself a stopword ("owned"->`own`, "mostly"->`most`), so a correct
      English vector can hold one. Applied to dev, it selected 6,637 rows of
      which only 387 looked genuinely `simple`-indexed. Rolled back in full
      from the snapshot; 0 rows left differing; no data lost.
- [x] 5.0b Replaced with `documents.unstemmed_fraction()`, scoring the fraction
      of lexemes that change under English stemming.
- [x] 5.0c Threshold set at 0.25, outside the measured gap rather than inside
      it, because the stemmer is not idempotent and an adversarial but correct
      fixture scored 0.123. Costs one document corpus-wide.
- [x] 5.0d Added preflight check 10 and verify assertion 5, both of which fail
      if any row below the threshold is selected or was rewritten.
- [x] 5.0e Re-tested with fixtures including a correct English vector holding
      stemmer-produced stopword lexemes — the exact case that fooled the first
      selector, and which the original fixtures lacked.
- [x] 5.0f Re-measured both databases: 402 documents / 278 collections on dev,
      628 / 454 on prod.

## 6. Local verification of the rebuilt selector

Five fixtures: two `simple`-built, one `english`-built, one `english`-built
holding stemmer-produced stopwords, one with an empty vector.

- [x] 6.1 Preflight targets exactly the two broken documents.
- [x] 6.2 The adversarial document scores 0.123 and lands in the grey zone,
      untargeted.
- [x] 6.3 Migration repairs exactly 2.
- [x] 6.4 Verify: 7 PASS, assertion 6 reports the one grey-zone row as INFO.
- [x] 6.5 Documents 3, 4 and 5 are byte-identical to their pre-migration state.
- [x] 6.6 A repaired vector is byte-identical to the correctly-indexed one
      built from the same text.
- [x] 6.7 Inflected search (`geology`, `mapping`, `resources`) matches
      afterwards.
- [x] 6.8 A second run repairs 0.

## 7. Rollout

- [x] 7.1 Preflight against `devazlib`, 2026-11-16: all four CHECK rows PASS.
      402 targets across 278 collections, 355 fully recoverable, 47 at the
      position cap, 1 grey-zone row left alone, 8,513 empty vectors.
- [x] 7.2 Applied to `devazlib` 2026-11-16: **402 documents repaired in 42
      seconds**. Verify reports 7 PASS and 1 INFO, including assertion 5
      (anti-destruction). A second run repairs 0. Every repaired row sat in
      document_id 20007-23506 — the newest documents — matching the finding
      that recent ingests are the broken ones.
- [x] 7.3 Spot-checked on dev. Among repaired documents, matches for `geology`
      went from 31 to 387, `resources` from 8 to 297, `mines` from 207 to 289,
      `drilling` from 142 to 221. **192 collections became reachable** for
      geology/mining/resources that were not before. Individually confirmed:
      `Spring_1987.pdf`, `StateGeologicalSurveyContributions.pdf` and
      `OPCNM_CR24B_report.pdf` all scored ~0.59 before, were not found by a
      search for "geology", and are now.
- [x] 7.4 Applied to `azlibrary` (production) 2026-11-16. Preflight: all four
      CHECK rows PASS, 628 targets across 454 collections, 544 fully
      recoverable, 84 at the position cap, first run. **628 documents repaired
      in 39.6 seconds.** Verify reports 7 PASS and 1 INFO, including assertion
      5 (anti-destruction). A second run repairs 0.
      Impact on prod, measured across the repaired rows: `geology` 37 -> 592,
      `resources` 9 -> 448, `mines` 272 -> 398, `drilling` 192 -> 304,
      `mapping` 495 -> 526, `faulting` 313 -> 365. `copper` is unchanged at
      267, as expected — it stems to itself, so it is a control showing the
      gains are stemming recovery rather than an artifact.
      **251 public, non-removed collections became reachable** through the API
      search path for geology/mining/resources/mineral.
- [ ] 7.5 Drop `documents.documents_backup_tsconfig` on both databases once
      satisfied. Each holds the pre-repair vectors (402 on dev, 628 on prod)
      and is the only route back.
- [ ] 7.6 **Deploy the `azlibAdd/documents.js` fix.** Until it ships, newly
      ingested documents keep joining the broken set at roughly 70 a year, and
      this repair will need running again.

## 8. Follow-ups (not this change)

- [ ] 7.1 Re-extraction for prod documents whose tails were clamped
      at the position cap. Only re-extraction restores their word order, and
      only phrase queries spanning the tail are affected. Needs the azlibAdd
      pipeline over their collection archives.
- [ ] 7.2 `azlibConfigPG/schemas/01-public.sql` cannot build a database from
      scratch: `lineage` and `lineage_removed` (lines 87, 94) reference
      `collections`, created at line 103. Hit again while building this
      change's test database. Unrelated to this change, still broken.
- [ ] 7.3 Consider asserting the expected `default_text_search_config` at
      azlibAdd startup, so a mismatched server is noticed at ingest rather than
      years later in a search audit.
- [ ] 8.4 **43% of documents have an empty tsvector** — 8,936 of 20,639 on
      prod, 8,513 of 20,019 on dev. Extraction produced nothing, almost
      certainly scanned pages with no text layer; `text_extractor.js` has
      `pdf-parse` commented out and textract returns nothing for them. They are
      invisible to full-text search regardless of configuration. This is a
      larger hole than the defect this change fixes and needs OCR, not SQL.
