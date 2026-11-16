## Context

`metadata.azgs` stores each collection's footprint twice: as four numbers under
`json_data->'bounding_box'`, and as a PostGIS geometry in the `geom` column.
The second is derived from the first by `metadata.geom_trigger()`, a
`BEFORE INSERT OR UPDATE` row trigger that evaluates
`ST_MakeEnvelope(west, south, east, north, 4326)` and assigns the result to
`new.geom`. Nothing else writes `geom`.

This means a geometry repair is a `json_data` repair. It also means the
correctness assertion is the *inverse* of the one that governed
`normalize-metadata-json`: there, `geom` had to be provably unchanged; here,
`geom` must change, on exactly the rows we intend and no others.

The defects are not detectable by validity checks. Every row's `geom` passes
`ST_IsValid`, no row has a NULL geometry, and `ST_MakeEnvelope` happily builds
a ring from longitudes in descending order — it simply winds the polygon the
other way. A box in Inner Mongolia is as valid as a box in Yavapai County. The
only signal is plausibility, which is why the repair rules are stated in terms
of an Arizona envelope rather than a validity predicate.

This change depends on `normalize-metadata-json` having run, which it has on
both databases. Coordinates are JSON numbers, so the transform can cast
directly without the string-trimming the earlier migration needed.

## Goals / Non-Goals

**Goals**

- Return every mechanically-identifiable mislocated collection to Arizona map
  search.
- Leave every ambiguous record exactly as found, and name it in a report.
- Touch `json_data` only; let the existing trigger maintain `geom`.

**Non-Goals**

- Fixing the producer that writes absolute longitudes. Data only, consistent
  with the scope taken for `normalize-metadata-json`.
- Adding a `CHECK` constraint against positive longitudes. It is the right
  guard against recurrence, but it belongs with the producer fix; adding it
  here would also reject the legitimate antimeridian extents.
- Improving coarse-but-correct extents. A national compilation with a
  continental bounding box is imprecise, not wrong.
- Deciding what the 10 quarantined records *should* say. That is a curatorial
  judgement, not a migration.

## Decisions

### Repair `json_data`, never `geom`

The migration issues no write to the `geom` column. Updating `json_data`
fires `geom_trigger()`, which recomputes the envelope from the corrected
coordinates. Writing `geom` directly would be both redundant and dangerous:
the trigger would overwrite it from `json_data` in the same statement, so a
direct write that disagreed with the JSON would silently vanish, and the two
representations could drift.

### Guard the sign flip on "lands in Arizona", not on sign alone

The rule is not "negate every positive longitude". It is "negate both
longitudes *when doing so produces a box intersecting the Arizona envelope*".

The guard costs nothing and buys the two records that would otherwise be
corrupted: collection 28135 sits at 152.6°E in Papua New Guinea and collection
28139 at 10–16°E in Bosnia. Both are `USGIN` records that legitimately describe
non-Arizona locations, and both store two positive longitudes. A sign-only
rule would move them into the Pacific and the Atlantic respectively.

Requiring *both* longitudes positive is the second half of the guard: it is
what keeps the rule away from the antimeridian-spanning world extents (19 on
prod, 12 on dev), where a positive `east` alongside a negative `west` is
exactly correct.

The envelope is deliberately Arizona rather than something looser like "the
western hemisphere". Empirically it costs nothing — of 458 both-positive rows,
456 land in Arizona under negation and the 2 that do not are the genuine
foreign records above — and it makes the rule's intent checkable.

### Negate and normalize ordering in one expression

Rather than negating and then fixing any resulting `west > east`, the
transform computes both endpoints from the magnitudes:

```
west := -greatest(abs(east), abs(west))
east := -least(abs(east), abs(west))
```

This is correct whichever order the magnitudes were stored in, and it makes
the ordering invariant true by construction rather than by a follow-up pass.
Only 2 of the 456 rows actually need the reordering, but a formulation that
cannot produce a descending pair is worth more than one that usually doesn't.

### Five rules: four for longitude, one for latitude

| Rule | Condition | dev | prod | Action |
| --- | --- | --- | --- | --- |
| A | `east > 0 AND west > 0` and negation intersects Arizona | 456 | 456 | negate both, normalize order |
| B | `west > east`, both negative | 5 | 5 | exchange `east` and `west` |
| C | `collection_id = 27608` with its exact stored values | 0 | 1 | exchange `east` and `south` |
| D | `west > 0 AND east < 0` and negating `west` intersects Arizona | 1 | 0 | negate `west`, normalize order |
| E | `south > north` | 1 | 1 | exchange `north` and `south` |

The four longitude rules each assign `east` and `west` outright, so they must
be mutually exclusive; the preflight proves it pairwise rather than assuming
it. Rule E only assigns the latitudes, so it **composes** with a longitude
rule rather than competing with one — the single exception being Rule C,
which reassigns `south` from the stored `east`, and which the preflight
asserts never coincides with Rule E.

All five are applied as a single `CASE` per coordinate rather than as
sequential `UPDATE`s, so no row is written twice and each pays the per-row
trigger cost once.

### Rule E needs no Arizona guard

Every longitude rule is guarded on "the corrected box lands in Arizona",
because a positive longitude may be genuine. Rule E is different in kind: a
bounding box must have `south` at or below `north` everywhere on earth. There
is no latitude equivalent of crossing the antimeridian, so descending
latitudes are unambiguously wrong and the exchange is unconditionally correct.
Guarding it on Arizona would have made the rule narrower than the invariant it
enforces, and would have left genuinely broken records outside the state
unrepaired.

### Rule C is keyed to values, not only to an identifier

The single hand-corrected record is matched on `collection_id` **and** on its
current coordinates. Keyed on the identifier alone, a re-run would exchange
`east` and `south` a second time and undo the repair. Keyed on both, the
precondition fails after the first run and the statement becomes a no-op — the
same idempotency the other two rules get for free, since a negated longitude
is no longer positive and an exchanged pair is no longer descending.

### Batch with in-block `COMMIT`, as before

`metadata.azgs` carries six `BEFORE INSERT OR UPDATE` row triggers, each of
which creates and drops a per-row `TEMP TABLE`. That overhead, not the JSON
manipulation, is ~99% of migration runtime; the previous single-statement
attempt ran 22 minutes without completing. The same `DO $batch$` block over
`metadata_id` ranges with a per-batch `COMMIT` and `RAISE NOTICE` progress is
reused.

This migration touches 463 rows rather than ~23,900, so it should finish in
well under a minute. The batching is retained anyway, because the `UPDATE` must
still *scan* every row to evaluate the rules, and because an interrupted run
should leave committed progress rather than a 463-row rollback.

### The backup derives from the transform, not from a second copy of the rules

The backup is in two parts. Part 1 stores the `geom` of **every** row, with no
rule logic at all, which is what makes "every untouched row kept its geometry"
checkable without reference to any earlier migration's snapshot. Part 2 stores
each changing row's pre-image `json_data` in the same statement that repairs
it, as a data-modifying CTE sharing the `UPDATE`'s snapshot.

The first draft instead recomputed the rule set inside the backup `INSERT`.
That was wrong in a way that only showed up when the rules changed: the
backup had already been committed classifying two rows as "will not repair",
so when Rules D and E were added, those rows would have been repaired with no
pre-image to roll back to. Deriving the backup from the transform means the
two cannot disagree, including across a rule change between runs.

### Quarantine report is a query, not a table

The 10 implausible records are emitted by the verify script as a result set,
not written to a quarantine table. They need a person to look at them, and a
table would imply a workflow — claiming, resolving, ageing — that does not
exist. The report is reproducible at any time by re-running the script.

## Risks / Trade-offs

- **A sign-flipped record that genuinely belongs outside Arizona would be
  missed.** The Arizona guard only repairs what lands in Arizona. If a New
  Mexico record had dropped signs, this migration leaves it broken. Accepted:
  no such row exists today, and the alternative — a looser guard — risks
  corrupting genuine foreign records, which is the worse failure.
- **The repair makes 456 collections appear in search results that did not
  appear before.** This is the point, but it is a visible change to result
  counts for any saved or bookmarked spatial query. Flagged in Impact.
- ~~**The 14,599 degenerate points are assumed intentional.**~~ Resolved: the
  data owner confirmed on 2026-11-16 that these are correct point locations,
  not truncated extents. They are now preserved by an explicit requirement
  rather than by assumption, so any future change that would expand or null
  them has to argue against the spec first.
- ~~**The rule set is complete.**~~ It was not. The first dev run left two
  records violating requirements this spec already stated — one with a single
  sign-flipped longitude, one with transposed latitudes — because the rules
  only covered *both* longitudes positive and said nothing about latitude
  order. The verification caught both. Rules D and E now cover them, and the
  episode is the argument for running the full sequence on dev before prod,
  rather than treating dev as a formality: prod carries one of the two.
- **Collection 27608's correction is a judgement, not a derivation.** The
  evidence is strong — reading the four values in the transposed order yields
  the state of Arizona almost exactly, for a record titled *Arizona Aqueous
  Chemistry* — but it is one person's reading of one record. It is isolated in
  its own rule so it can be dropped without affecting the other 462.

## Migration Plan

1. Run the read-only preflight against `devazlib`, then `azlibrary`, and
   confirm the rule populations match the counts in proposal.md.
2. Back up all affected rows to `metadata.azgs_backup_geometry` in its own
   transaction, inserting only rows not already present.
3. Run the batched repair against `devazlib`. Verify, then check the dev web
   client's map search for a sample of repaired collections.
4. Run against `azlibrary`. Verify.
5. Emit the quarantine report from both databases and hand it to curation.
6. `VACUUM ANALYZE metadata.azgs`.

Rollback is a restore of `json_data` from `metadata.azgs_backup_geometry` for
the affected `collection_id`s; the trigger recomputes `geom` from the restored
values, so the backup's `geom` column is a check rather than a restore source.

## Consumer Compatibility

No consumer needs a change. The repair alters values within the existing
shape — four JSON numbers and a polygon — so every reader continues to work.

- **Web client map search** (`geom`, `geom_method`): repaired collections begin
  matching Arizona extents. No code change.
- **`azgs_geom_idx`** (GiST): maintained automatically by the `UPDATE`.
  `VACUUM ANALYZE` afterwards so the planner sees the new distribution.
- **ISO 19139 export**: publishes `bounding_box` verbatim, so exported metadata
  for repaired records becomes correct without a code change.
- **`metadata.azgs_backup_normalize`**: untouched. It remains the snapshot from
  the previous migration and is not a rollback source for this one.

## Open Questions

- Should the 2 `USGIN` records that genuinely sit abroad (Papua New Guinea,
  Bosnia) be in an Arizona geological library's spatial index at all? Out of
  scope here; a curation question.
- Collections 15738 and 16615 are both maps of the state of Arizona and share
  nearly the same wrong box, roughly 19.8° west and 5.2° north of where they
  belong. That consistency suggests one bad reprojection rather than two
  typos. If the transform can be identified, a later change could repair them
  as a recognised transposition; it is not recoverable from the stored values
  alone today.
