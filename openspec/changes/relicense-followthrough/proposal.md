## Why

`normalize-metadata-json` relicensed the collection to `CC BY-SA 4.0` and
reached production on 12 November 2026. The NonCommercial term "is not correct
for AZGS material" — the commit says so, and the runbook's Notify step warned
consumers that `license.type` was about to change in the `/metadata` API and
the ISO 19139 export.

It changed, and then it started changing back.

The migration rewrote 23,003 existing rows. It did not touch the tools that
write new ones, and three of them carry the superseded licence as a hardcoded
default:

- `azlibAdd/azgsMetadata.js:151` — the metadata template every new collection
  is built from, in the main ingest tool
- `azlibConvert/azgsMetadata.js:27`
- `azlibContriveMineCollections/index.js:91`

So every collection ingested since the migration has been born asserting terms
AZGS does not place on its material, one record at a time, silently. Nobody
will notice, because nothing checks.

The deeper reason it recurred is in the spec. The requirement that records
assert `CC BY-SA 4.0` is written entirely in terms of the migration — "WHEN
the migration has completed, no row retains NonCommercial terms". That is a
statement about a sweep, not an invariant about writes. A spec phrased as an
outcome can be satisfied once and then quietly stop being true, which is
exactly what happened. The fix is not only to correct three literals; it is to
say what must hold whenever a record is written, and to put the check where
every tool passes through.

A licence is not a cosmetic field. For as long as this is wrong, the API
tells people they may not use AZGS material commercially.

## What Changes

- Correct the hardcoded licence in all three ingest paths to `CC BY-SA 4.0`
  and `https://creativecommons.org/licenses/by-sa/4.0/`.
- Correct the stale example blocks in `azlibAdd/README.md` and
  `azlibConvert/README.md`, which show the old object and are what someone
  copies when hand-building a metadata file.
- **Repair the records written since the migration.** A migration script in
  the established shape — preflight that counts and asserts, batched update,
  verification query — because the number of affected rows is not known and
  must be measured rather than assumed.
- **Restate the licence requirement as an invariant on writes** rather than
  as the outcome of one migration, so it is a rule about records and not a
  note about a day in November.
- **Add a database-level check** so that no future tool, script or manual
  `INSERT` can reintroduce the NonCommercial terms. The database is the one
  thing all three tools pass through; three npm packages with three private
  copies of the licence string is why this happened.

Explicitly **not** in this change:

- **No shared metadata module.** `azlibAdd` and `azlibConvert` each carry
  their own near-duplicate `azgsMetadata.js`, and
  `azlibContriveMineCollections` a third copy of the same fields. Collapsing
  them is worth doing and is a refactor across three npm packages, not a
  licence fix. The database check is what makes the duplication safe in the
  meantime.
- **No change to the API schema.** `metadata/openapi.json` and
  `collections/openapi.json` still declare the superseded licence as their
  sole permitted value; that is the same defect in another repository and is
  fixed by `publish-current-license` there. Neither change blocks the other.
- **No other licence.** This is not the place to decide whether AZGS might one
  day host third-party material under different terms. See design.md — that
  question is what the check's shape turns on, and the answer taken here is
  the one the current spec already asserts.

## Capabilities

### Modified Capabilities

- `metadata-json-format`: the licence requirement is rewritten from a
  migration outcome into a standing invariant that every stored record
  satisfies, however it was written, and gains the enforcement that makes it
  true rather than hoped for. The value itself does not change.

## Impact

- **Code**: `azlibAdd/azgsMetadata.js`, `azlibConvert/azgsMetadata.js`,
  `azlibContriveMineCollections/index.js`, and the two READMEs.
- **Migration**: a repair script plus preflight and verification, following
  `normalize-metadata-json`'s pattern, including its batching — the same six
  BEFORE triggers fire per row here.
- **Schema**: one check constraint on `metadata.azgs`. It is validated against
  existing rows, so it must be added *after* the repair, or it will fail.
- **Externally visible, again.** Records ingested since 12 November will
  change their `license` in the `/metadata` API and the ISO 19139 export, as
  the first relicense did. The same Notify step applies.
- **Ingest fails loudly if a tool is missed.** That is the intent. A rejected
  insert is recoverable; a wrong licence served for months is not.
- **Unmeasured.** The number of affected records is not known — database
  access was unavailable while drafting. The preflight exists to establish
  it, and the change should not be run until it has.
- **Rollout**: dev first. Production is gated on the whole workflow as always,
  and this one carries a repair whose row count nobody has seen yet.
