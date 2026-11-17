## Why three copies existed

`azlibAdd`, `azlibConvert` and `azlibContriveMineCollections` are three
separate npm packages. The first two each carry their own `azgsMetadata.js`,
near-duplicates of one another; the third builds the same fields inline. None
of them imports anything shared, so the licence string exists three times, and
a change to the licence has to be made three times by someone who knows all
three exist.

The migration's author knew the licence was changing and rewrote the table.
That is the part that was visible. The three defaults were not, and nothing
failed when they stayed behind.

Collapsing the three into one module is the obvious structural fix and this
change does not attempt it: it is a refactor across three packages with their
own dependency trees and release histories, done for the sake of one field.
What this change does instead is move the authority out of the tools
altogether.

## Where the invariant belongs

The database, as a check constraint on `metadata.azgs`.

Every one of the three tools writes through it. So does a hand-written
`INSERT`, a bulk load, and the fourth tool nobody has written yet. Putting the
rule there means a tool that is missed fails at the moment it is wrong, rather
than producing records that look fine until someone reads a licence six months
later.

```sql
alter table metadata.azgs
  add constraint azgs_license_current
  check (json_data->'license'->>'type' = 'CC BY-SA 4.0');
```

Two things follow from the ordering. The constraint validates against existing
rows when it is added, so it must come *after* the repair or it will fail on
the rows the repair exists to fix. And it must be added in the same change as
the tool fixes, or ingest breaks on the next run.

## The judgment call, stated plainly

A check constraint on the exact string asserts that AZGS will never host
material under any other licence. That is what the current spec says —
"every record SHALL carry a `license` object whose `type` is `CC BY-SA 4.0`"
— so the constraint is a faithful reading of it, not an extension.

But it is a policy decision wearing a schema change's clothes, and it should
be taken knowingly. If AZGS ever accepts a deposit under different terms, this
constraint is what stands in the way, and the remedy is to change the spec and
drop the constraint — a deliberate act, which is the right amount of friction
for a licensing decision.

The alternative considered was a BEFORE trigger that silently rewrites a
NonCommercial licence to the current one. It cannot break ingest and it is
self-healing. It was rejected: silent rewriting would also overwrite a
correct, deliberately different licence without telling anyone, and a field
with legal weight should fail loudly rather than be quietly corrected.

Task 3.3 is therefore separable. If the constraint is judged too strong, drop
that task and the rest of the change still stands — the tools are fixed and
the records are repaired. What is lost is the guarantee that it stays fixed.

## The repair, and what is not known

The row count is unmeasured. Database access was not available while this was
drafted, so the number of collections ingested since 12 November 2026 carrying
the superseded licence is unknown.

That is why the repair is a script with a preflight rather than a one-line
`UPDATE` someone runs by hand. The preflight counts and asserts before
anything is written, in the shape `normalize-metadata-json` established, and
the change should not be run until its output has been read.

Batching carries over for the same reason it did there: each row fires six
BEFORE triggers that rebuild `geom` and five tsvector columns, and a
single-statement pass over the table ran more than twenty minutes without
completing. If the preflight reports a handful of rows this is irrelevant, and
the script still batches, because the author of the next repair will copy this
one.

## Scope boundary with the API

`metadata/openapi.json` and `collections/openapi.json` declare the superseded
licence as the sole permitted value of `AZGS_license`. Every record in
production contradicts them, so a consumer validating against the published
schema rejects all of them.

That is the same defect and it is fixed separately, in `azlibrary_api`, by
`publish-current-license`. The two are deliberately not one change: they live
in different repositories, neither blocks the other, and the API schema should
not wait on a database migration to stop telling people the wrong licence.
