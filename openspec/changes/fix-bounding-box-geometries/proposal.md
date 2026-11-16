## Why

765 of 23,898 collections in `metadata.azgs` have a bounding box that does not
intersect Arizona, so they are invisible to the map-extent search that the web
client's `geom` parameter drives. Nothing ever errored, because the geometries
are *valid* — `ST_IsValid` is true for every row and there are no NULL
`geom` values. They are simply in the wrong place on the globe.

The dominant defect is a single mechanical one. 456 records store both
longitudes as **absolute values**, positive instead of negative, which puts
them in Asia. Collection 17039 is typical: `{"north": 31.833, "south": 31.633,
"east": 109.767, "west": 109.9}` yields `POLYGON((109.9 31.633, ...))` — the
right magnitudes, the wrong hemisphere, somewhere in Inner Mongolia. Negating
both longitudes lands every one of them back inside Arizona.

That one defect also accounts for the `west > east` ordering anomalies: every
affected row has its longitudes in descending order precisely *because* the
sign was dropped, and negating restores the correct ordering as a side effect.

These defects are pre-existing, not artifacts of the `normalize-metadata-json`
migration: `metadata.azgs_backup_normalize` holds `"109.767"` as a positive
string for collection 17039, exactly as it is now.

Measured against both databases. The two largest classes are **identical on
dev and prod** — 456 sign-flipped rows and the same five transposed rows in
each — which indicates old defects inherited by both rather than drift. The
small classes differ, and in both directions: each database holds one record
the other does not:

| Defect | dev (`devazlib`) | prod (`azlibrary`) | Repairable |
| --- | --- | --- | --- |
| Both longitudes stored positive; negating lands the box in Arizona | 456 rows | 456 rows | yes, mechanically |
| `east` and `west` transposed, both already negative | 5 rows | 5 rows | yes, mechanically |
| `west` alone stored positive; negating lands the box in Arizona | 1 row | none | yes, mechanically |
| `north` and `south` transposed | 1 row | 1 row | yes, mechanically |
| `east` and `south` transposed in one record | none | 1 row | yes, by hand |
| Latitude outside ±90, not recoverable | none | 1 row | no — report |
| Arizona record placed at arctic latitude | 5 rows | 5 rows | no — report |
| "State of Arizona" map placed in the Pacific Ocean | 2 rows | 2 rows | no — report |
| Known test record (`series` = `DGM-asdf`) | 1 row | 1 row | no — report |
| Degenerate point 1° south of the border | 1 row | 1 row | no — report |

Each database repairs 463 rows, by slightly different routes: dev has the
lone single-longitude defect, prod has the lone hand-corrected transposition,
and both have the transposed latitudes. The two records with an out-of-range
latitude are `USGIN` rows that exist only on prod. Prod additionally holds
some 300 legitimate national and continental extents that dev lacks, nearly
all `USGIN`, which are out of scope.

The single-longitude and transposed-latitude classes were **not** in the
original rule set. They were found by the verification script after the first
dev run, which failed on two records the rules had not claimed. Both are now
covered.

## What Changes

- Negate both longitudes on records that store them as absolute values, and
  normalize the pair so `west <= east`. The transform applies only where
  negating lands the box inside Arizona; this guard is what excludes the two
  `USGIN` records that genuinely sit in the eastern hemisphere (collection
  28135 in Papua New Guinea, collection 28139 in Bosnia).
- Swap `east` and `west` on the five records that store them in the wrong
  order with both values already negative.
- Negate `west` alone on the one record that stores it positive while `east`
  is negative. Its envelope currently spans 220 degrees of longitude, so it
  matches map searches across most of the world.
- Swap `north` and `south` on the one record in each database that stores them
  in descending order. Unlike the longitude rules this needs no Arizona guard:
  a bounding box must have `south` at or below `north` everywhere on earth.
- Correct collection 27608 (`Arizona Aqueous Chemistry`), whose `east` and
  `south` values are each other's: stored as `{"north": 37.232, "south":
  -108.872, "east": 31.130, "west": -115.025}`, read correctly it is exactly
  the state of Arizona.
- Emit a **quarantine report** of the 10 records (9 on dev) that remain implausible but
  cannot be repaired mechanically, as a table for curatorial follow-up. The
  migration does not alter them.
- Recompute `geom` for every repaired record. This happens automatically:
  `metadata.geom_trigger()` derives `geom` from `json_data->'bounding_box'` on
  every `UPDATE`, so the migration writes `json_data` only.

### Out of scope

- **14,599 degenerate points inside Arizona** (`north = south` and
  `east = west`). For ADMMR and Heinrichs mine records a point location is the
  honest representation of what is known, not a defect; the data owner
  confirmed this on 2026-11-16. Left untouched.
- **~300 national and continental extents**, 292 of them `USGIN` AASG
  geothermal compilations whose extent genuinely spans the continent, plus a
  handful of Special Paper chapters that are legitimately about Texas, Nevada,
  Utah and the Upper Midwest. Coarse, not wrong.
- **19 near-global extents on prod, 12 on dev**, spanning the antimeridian
  (`west` near -180, `east` near +180). These are the only rows where a positive `east` is
  correct, and the Rule A condition requires *both* longitudes positive
  precisely so that it never touches them.
- **Producer fixes.** Whatever writes absolute longitudes is still doing so;
  this change repairs stored data only, consistent with the scope decision
  taken for `normalize-metadata-json`. The producer defect is recorded as a
  follow-up.
- **Schema changes.** No new columns, constraints, functions or triggers. A
  `CHECK` constraint forbidding positive longitudes would be the natural
  guard against recurrence, but it belongs with the producer fix.

## Impact

- Affected data: `metadata.azgs.json_data->'bounding_box'` and the derived
  `metadata.azgs.geom`, on 463 rows in each database.
- Records that do not intersect Arizona fall from 765 to 309 on prod, and from
  470 to 14 on dev. The newly-reachable records all come from Rule A. The
  transposition repairs (Rules B and E) exchange two endpoints, which yields
  the same rectangle wound the other way, so they move no geometry at all;
  Rule C's record already matched Arizona extents because its box spanned 146
  degrees of latitude. Those records are repaired for correctness, not
  visibility.
- Of the 309 that remain on prod, some 301 are legitimate wide or out-of-state
  extents and 8 are quarantined. The other two quarantined records match
  Arizona extents today only because their boxes are absurd: collection 16634
  spans 17°N to 75°N, and collection 26683 has a south bound of -127.7.
- Affected consumers: the web client's map search (`geom` / `geom_method`
  parameters), the `azgs_geom_idx` GiST index, and ISO 19139 metadata export,
  which publishes the bounding box verbatim.
- No API or client code changes. The repair is invisible except that affected
  records start appearing in spatial results.
- Reversible: the pre-migration `json_data` and `geom` of every touched row
  are preserved in `metadata.azgs_backup_geometry`.
