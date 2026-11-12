# migrations

One-off SQL data migrations, run with `psql`. There is no migration runner and
no ordering convention: each file is self-contained, idempotent, and names the
database it expects.

## Running

`devazlib` (dev) and `azlibrary` (prod) live on the **same RDS cluster** and are
reachable at the same host and port, differing only by database name. Always
pass the database explicitly, and always pass `-v target_db=` matching it —
every migration aborts if `current_database()` does not match:

```
psql -h <host> -U <user> -d devazlib -v target_db=devazlib \
     -f migrations/normalize-metadata-json.sql
```

## Conventions

- Scripts are idempotent: re-running one changes nothing on already-migrated
  data.
- Scripts that modify `metadata.azgs` snapshot the affected rows into a backup
  table first. The snapshot is written once and preserved across re-runs, so it
  always holds the original pre-migration state.
- Every migration has a matching `verify-*.sql` that returns one row per
  assertion with a violation count; all counts must be zero.

Note that `metadata.azgs` carries six `BEFORE INSERT OR UPDATE` row triggers
that recompute `geom` and five `tsvector` columns from `json_data`. Those
columns cannot be updated independently, and the trigger cost dominates any
migration that touches many rows.
