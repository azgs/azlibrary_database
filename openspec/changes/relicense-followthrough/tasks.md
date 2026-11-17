## 1. Stop writing the superseded licence

- [ ] 1.1 `azlibAdd/azgsMetadata.js:151-152` — set the default template's
      licence to `CC BY-SA 4.0` and `https://creativecommons.org/licenses/by-sa/4.0/`.
- [ ] 1.2 `azlibConvert/azgsMetadata.js:27-28` — the same.
- [ ] 1.3 `azlibContriveMineCollections/index.js:91-92` — the same.
- [ ] 1.4 `azlibAdd/README.md:215-216` and `azlibConvert/README.md:92-93` —
      correct the example metadata blocks. These are what someone copies when
      hand-building a record, so a stale example is a stale record later.
- [ ] 1.5 Grep the repository for `by-nc-sa` and `BY-NC-SA` and confirm the
      only remaining hits are historical: the `normalize-metadata-json`
      runbook and archived specs, which describe the change and should keep
      saying what the old value was.

## 2. Repair what was written

- [ ] 2.1 `migrations/preflight-relicense-followthrough.sql`: count rows whose
      `license.type` is not `CC BY-SA 4.0`, break the count down by value,
      and report the earliest and latest `collection_id` affected. Read-only,
      writes nothing, fires no trigger.
- [ ] 2.2 **Run the preflight and read it before writing the repair's
      expected figures.** The row count is currently unknown; no number goes
      into this change until it has been measured.
- [ ] 2.3 `migrations/relicense-followthrough.sql`: set the current licence
      object on every row that does not carry it, batched by `metadata_id`
      as `normalize-metadata-json` is, and guarded by the same
      `current_database()` check so it cannot be run against the wrong
      database by accident.
- [ ] 2.4 Write a backup table before updating, as `normalize-metadata-json`
      does, holding `collection_id` and the pre-repair licence.
- [ ] 2.5 `migrations/verify-relicense-followthrough.sql`: assert no row has
      `nc` or `NC` in `license.type` or `license.url`, and that every row has
      `license.type = 'CC BY-SA 4.0'`.

## 3. Make it stay fixed

- [ ] 3.1 Confirm the repair has completed and verification passes. The
      constraint validates existing rows on creation and will fail otherwise.
- [ ] 3.2 Confirm tasks 1.1–1.3 are in the same deployment. Adding the
      constraint while a tool still writes the old value breaks ingest.
- [ ] 3.3 Add the `azgs_license_current` check constraint to `metadata.azgs`.
      **Separable** — see design.md. If the constraint is judged too strong a
      commitment, drop this task; the rest of the change stands without it.
- [ ] 3.4 Prove it: attempt an insert carrying the NonCommercial licence and
      confirm it is rejected.

## 4. Verification

- [ ] 4.1 Run the three tools' metadata composition against devazlib and
      confirm each new record carries the current licence.
- [ ] 4.2 Confirm `/metadata` returns the current licence for a record
      ingested after the fix, end to end.
- [ ] 4.3 Confirm the ISO 19139 export carries it too — the runbook named it
      as externally visible and it is the one consumer nobody tests.

## 5. Rollout

- [ ] 5.1 Dev first: repair, constraint, and the three tools together.
- [ ] 5.2 Notify, as `normalize-metadata-json`'s runbook did. Records
      ingested since 12 November change their licence in the `/metadata` API
      and the ISO 19139 export.
- [ ] 5.3 Production is gated on the whole workflow, and on the preflight
      having been read.
