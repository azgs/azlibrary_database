# Runbook — normalize-metadata-json against `azlibrary` (production)

Prepared 2026-11-12. Dev was migrated and verified the same day.

`devazlib` and `azlibrary` are two databases on **one RDS instance** at the same
host and port. Every command below names the database explicitly, and the
migration itself aborts unless `current_database()` matches `target_db`. Do not
drop the `-d` / `-v target_db=` arguments.

Host: `cos-azulibrarydatabase-prod.cluster-c0xzlo6s7duc.us-west-2.rds.amazonaws.com`
User: `admin6653`

## Credentials

`~/.pgpass` holds a **devazlib-only** entry, deliberately: production is not in
it, so none of these commands authenticate silently against prod. Supply the
password for the run, e.g. by exporting `PGPASSWORD` from `.env` in the shell
you run it from, and clear it afterwards.

## 0. Expectations

| | dev (measured) | prod (projected) |
| --- | --- | --- |
| rows rewritten | 23,003 | 23,897 |
| wall clock | 15m 27s | ~16–17 min |
| second run | 0 rows, 8s | same |

Over 99% of the runtime is per-row trigger work — six `BEFORE` triggers per row
rebuilding `geom` and five `tsvector` columns. The transform itself costs ~8s.
Because both databases share one instance, that load lands on production
regardless of which database is being migrated.

## 1. Immediately before the run

Re-profile and pre-flight. Prod's defect population differs from dev's and is
still growing — the `informalname` misspelling in particular arrives with new
records from the admin upload form, which this change does not fix.

```
psql -h <host> -U admin6653 -d azlibrary -f migrations/preflight-normalize-metadata-json.sql
```

Read-only; writes nothing and fires no trigger. **Every assertion must say
PASS.** Row 18 reports how many rows would be rewritten — expect roughly 23,897.
Last run: 17/17 PASS, 23,897 rows.

## 2. Notify

The relicense is externally visible. `license.type` changes from
`CC BY-NC-SA 4.0` to `CC BY-SA 4.0` in the `/metadata` API, the ISO 19139
export, and anything harvesting them.

## 3. Run

```
psql -h <host> -U admin6653 -d azlibrary -v target_db=azlibrary -v batch_size=500 \
     -f migrations/normalize-metadata-json.sql
```

Writes `metadata.azgs_backup_normalize` first (collection_id, pre-migration
json_data, pre-migration geom), then commits in batches of 500 by
`metadata_id`, printing progress every ten batches. Safe to interrupt: every
rule is a no-op on normalized input, so re-running resumes.

Expect a flood of `NOTICE: table "tabletemp" does not exist, skipping` — that
is the existing triggers, not an error.

## 4. Verify

```
psql -h <host> -U admin6653 -d azlibrary -f migrations/verify-normalize-metadata-json.sql
```

All 16 assertions must report zero violations. The one that matters most is
**"geom unchanged vs backup"**: the bounding box type change must leave every
derived geometry spatially identical. Investigate any failure before anything
else.

## 5. Confirm idempotency and reclaim space

Re-run step 3; it should report `0 rows changed` in a few seconds. Then:

```
psql -h <host> -U admin6653 -d azlibrary -c "VACUUM (ANALYZE) metadata.azgs;"
```

## 6. Spot-check the live site

Open an item page on the production client and confirm the license reads
CC BY-SA 4.0, keywords group under Temporal rather than time, the map renders,
and year filtering works.

Note the citation-export fix (azgs/azlibrary_react#53) must be **deployed**, or
the RIS and EndNote downloads will print `PY - null` for the 44 records whose
year is null. Deploy that before or with this migration.

## Rollback

`json_data` has no history; the backup table is the only route back.

```
UPDATE metadata.azgs m
   SET json_data = b.json_data
  FROM metadata.azgs_backup_normalize b
 WHERE m.collection_id = b.collection_id
   AND m.json_data IS DISTINCT FROM b.json_data;
```

This re-fires the triggers, so `geom` and the tsvectors rebuild from the
restored JSON. It is as slow as the migration. Keep the backup table until the
release is accepted, then drop it (dev's was 40 MB).

## Known and deliberately not addressed

- **Producers are unfixed.** Re-ingestion reintroduces every defect. The
  `informalname` source is `azlibrary_admin`'s upload form; the API's
  `form.html` still defaults to the old NC license.
- **~470 rows have positive longitudes** and ~455 have west east of east, on
  dev. Pre-existing; the migration preserves the values exactly, so these
  records keep plotting in the wrong hemisphere.
- **Test and placeholder records** remain, normalized like any other row.
- **`identifiers.doi` and `identifiers.collection_id`** are null on every row.
