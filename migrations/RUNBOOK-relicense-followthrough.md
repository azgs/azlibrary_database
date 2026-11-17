# Runbook: relicense-followthrough

Finishes the CC BY-SA 4.0 relicense. `normalize-metadata-json` rewrote the
table on 12 November 2026 but left three ingest tools stamping the superseded
licence onto new records; this repairs what they wrote and stops them.

The affected row count is **not known in advance**. Step 1 establishes it.

## 0. Prerequisites

The three tool fixes must be deployed in the same window as step 4, or ingest
breaks:

- `azlibAdd/azgsMetadata.js`
- `azlibConvert/azgsMetadata.js`
- `azlibContriveMineCollections/index.js`

If the constraint in step 4 is being skipped (see below), this still matters —
without the fixes the repair simply undoes itself on the next ingest.

## 1. Preflight

```
psql -h <host> -U admin6653 -d azlibrary -f migrations/preflight-relicense-followthrough.sql
```

Read-only; writes nothing and fires no trigger. Section 1 row 2 is the number
of rows the repair would rewrite; section 2 shows what the affected rows
actually assert, and section 3 lists them if there are fewer than 100.

**Read this before going further.** If row 2 is zero, nothing below needs
running and only the tool fixes matter.

## 2. Notify

The relicense is externally visible, exactly as it was the first time.
`license.type` changes in the `/metadata` API, the ISO 19139 export, and
anything harvesting them — this time for records ingested since 12 November.

## 3. Repair

```
psql -h <host> -U admin6653 -d azlibrary -v target_db=azlibrary -v batch_size=500 \
     -f migrations/relicense-followthrough.sql
```

Writes `metadata.azgs_backup_relicense` first, holding `collection_id` and the
pre-repair licence for each affected row. Idempotent: a second run reports 0
rows changed.

## 4. Constraint — optional, and a decision

```
psql -h <host> -U admin6653 -d azlibrary -v target_db=azlibrary \
     -f migrations/constraint-relicense-followthrough.sql
```

This asserts that no record may ever carry another licence. It is a faithful
reading of the current spec and it is also a policy commitment; see
`openspec/changes/relicense-followthrough/design.md`. Skipping it leaves the
repair and the tool fixes intact, and leaves nothing preventing a fourth tool
from reintroducing the problem.

Must run **after** step 3 — it validates existing rows and will fail
otherwise — and **with** the tool fixes deployed.

## 5. Verify

```
psql -h <host> -U admin6653 -d azlibrary -f migrations/verify-relicense-followthrough.sql
```

Every assertion must report PASS. Assertion 6 checks for the constraint; if
step 4 was deliberately skipped, expect it to fail and ignore it.

Then confirm end to end, which the first relicense did not:

- `/metadata` returns `CC BY-SA 4.0` for a record ingested after the fix
- the ISO 19139 export carries it too — named as externally visible both
  times, and the one consumer nobody tests
- `node tools/check-schema-fidelity.js` in `azlibrary_api` reports agreement

## 6. Rollback

```sql
UPDATE metadata.azgs a
   SET json_data = jsonb_set(a.json_data, '{license}', b.license)
  FROM metadata.azgs_backup_relicense b
 WHERE b.collection_id = a.collection_id AND b.license IS NOT NULL;
```

Drop the constraint first if it was applied:

```sql
ALTER TABLE metadata.azgs DROP CONSTRAINT azgs_license_current;
```

Rolling back restores a licence AZGS does not place on its material, so this
is for recovering from a failed run, not for reconsidering the relicense.
