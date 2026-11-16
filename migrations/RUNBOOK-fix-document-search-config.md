# Runbook — fix-document-search-config against `azlibrary` (production)

Repairs `documents.documents.text_search` rows indexed under the server's
default text search configuration (`simple`) instead of English, and ships
alongside the one-line fix to `azlibAdd/documents.js` that stops new documents
joining the broken set.

Spec and design: `openspec/changes/fix-document-search-config/`.

## Credentials

`devazlib` and `azlibrary` share one RDS cluster endpoint and differ only by
database name. Every command below names the database explicitly and passes a
matching `-v target_db=`; the script aborts if the two disagree.

## 0. Expectations

| | devazlib | azlibrary |
| --- | --- | --- |
| documents | 20,019 | 20,639 |
| to repair | 402 | 628 |
| collections affected | 278 | 454 |
| grey zone, deliberately not repaired | 1 | 1 |
| empty vector, unsearchable either way | 8,513 | 8,936 |

The repair corrects stemming for every affected document. It does not restore
word order beyond the position cap, which was lost at ingest and is not
recoverable without re-extraction. No document is made worse.

Deploy the `azlibAdd/documents.js` fix **before or with** this repair. If the
old code keeps running afterwards, newly ingested documents will quietly
rejoin the broken set and the repair will need running again.

## 1. Immediately before the run

```
psql -h <host> -U <user> -d azlibrary \
     -f migrations/preflight-fix-document-search-config.sql
```

Every CHECK row must read PASS. Record the output. Row 10 reports how many
documents become findable for one sample term — a useful before/after number.

## 2. Notify

The repair writes to the index behind the site's Full-Text Search. Searches
run during the window return a mix of repaired and unrepaired results. Nothing
breaks, but results shift under users.

## 3. Run

```
psql -h <host> -U <user> -d azlibrary -v target_db=azlibrary \
     -f migrations/fix-document-search-config.sql
```

Pass `-v batch_size=500` to override the default batch size. The script reports
the repaired count and elapsed time on completion. An interrupted run is
resumed by running it again: repaired rows no longer match the selector.

## 4. Verify

```
psql -h <host> -U <user> -d azlibrary \
     -f migrations/verify-fix-document-search-config.sql
```

Assertions 1–5, 7 and 8 must report zero violations. **Assertion 5 is the
important one**: it confirms no row scoring below the threshold was rewritten,
which is the failure an earlier version of this script actually committed on
dev. Assertion 6 is informational and counts grey-zone rows left alone; one on
each database at the time of writing.

## 5. Confirm idempotency

```
psql -h <host> -U <user> -d azlibrary -v target_db=azlibrary \
     -f migrations/fix-document-search-config.sql
```

Must report `Repaired 0 document(s)`.

## 6. Spot-check the live site

Pick a repaired document, take a distinctive word from it in an inflected form
(`mapping`, `resources`, `faulting`), and search it in the site's Full-Text
Search box. It should now return the collection. Before the repair it would
not have.

## Rollback

```
UPDATE documents.documents d
   SET text_search = b.text_search
  FROM documents.documents_backup_tsconfig b
 WHERE d.document_id = b.document_id;
```

This restores the broken-but-original vectors. The backup is written once and
preserved across re-runs, so it always holds the true pre-repair state.

Drop the backup only after both databases are repaired and verified:

```
DROP TABLE documents.documents_backup_tsconfig;
```

## Known and deliberately not addressed

- **Tails beyond the 16,383 position cap.** 1,715 prod documents. Stemming is
  fixed; phrase queries spanning the clamped tail stay unreliable, exactly as
  they are today. Re-extraction is the only remedy and is tracked as a
  follow-up.
- **The grey zone.** Documents scoring between 0.12 and 0.25 are not repaired.
  One on each database. Missing a borderline document is recoverable;
  destroying a correct one is not, so the threshold errs high.
- **Documents with an empty vector.** 8,936 on prod, 43% of the corpus. They
  are invisible to full-text search regardless of configuration and this repair
  does nothing for them. They need OCR.
- **Casing and punctuation.** Already lost in the stored vector. The repair
  works from lexemes, so tokens like `U.S.G.S.` are re-parsed from whatever
  `simple` made of them. This affects how a few tokens split, not whether a
  document is findable.
- **The server default itself.** Left as `simple`. Changing it would mask the
  bug and alter behaviour for every other consumer of the default; the fix
  belongs at the call site.
