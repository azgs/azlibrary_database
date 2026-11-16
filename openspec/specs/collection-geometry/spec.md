# collection-geometry Specification

## Purpose
Defines the spatial invariants that every stored `metadata.azgs` bounding box
satisfies, and the relationship between the stored `bounding_box` object and
the derived `geom` column, so that map-extent search returns a collection
whenever its real footprint falls in the searched area.

This capability governs where a box *is*. The JSON types of its four
coordinates are governed by `metadata-json-format`, which this capability
assumes: every coordinate is already a JSON number.

Throughout, **the Arizona envelope** means
`ST_MakeEnvelope(-115.5, 31.0, -108.5, 37.5, 4326)` — the state's extent
padded by roughly half a degree on each side.

## Requirements

### Requirement: Longitudes SHALL be signed

`bounding_box.east` and `bounding_box.west` SHALL carry the sign of their
hemisphere. A record SHALL NOT store a western-hemisphere longitude as a
positive magnitude.

Where a record stores a longitude as a positive value and negating the
positive longitudes produces a box that intersects the Arizona envelope, the
stored values are a dropped-sign defect and SHALL be corrected by negation.
Where negating does not produce such a box, the record SHALL be left
unchanged, because a positive longitude may be genuine.

The defect occurs on both longitudes together and on `west` alone. A record
with `east` positive and `west` negative is not treated as a defect: that is
how an extent crossing the antimeridian is stored.

#### Scenario: Both longitudes stored as positive magnitudes

- **WHEN** a record stores `{"east": 109.767, "west": 109.9}` with latitudes in
  Arizona's range
- **THEN** it stores `{"east": -109.767, "west": -109.9}`
- **AND** its `geom` intersects the Arizona envelope

#### Scenario: Positive longitude that is genuinely eastern-hemisphere

- **WHEN** a record stores `{"east": 152.632, "west": 152.536}` with latitudes
  near -3, placing it in Papua New Guinea
- **THEN** its coordinates are unchanged
- **AND** the record is not reported as a defect

#### Scenario: Only the western longitude stored as a positive magnitude

- **WHEN** a record stores `{"east": -109.875, "west": 110.056}` with latitudes
  in Arizona's range
- **THEN** it stores `{"east": -109.875, "west": -110.056}`
- **AND** its envelope no longer spans 220 degrees of longitude

#### Scenario: Extent spanning the antimeridian

- **WHEN** a record stores `{"east": 180, "west": -180}` as a whole-world extent
- **THEN** its coordinates are unchanged, because only one of the two
  longitudes is positive

### Requirement: Longitudes SHALL be stored in ascending order

`bounding_box.west` SHALL be less than or equal to `bounding_box.east`, except
for an extent that genuinely crosses the antimeridian.

#### Scenario: East and west transposed with both values negative

- **WHEN** a record stores `{"east": -114.81, "west": -109.05}`
- **THEN** it stores `{"east": -109.05, "west": -114.81}`
- **AND** the two values are exchanged, not recomputed

#### Scenario: Ordering restored as a consequence of negation

- **WHEN** a record's longitudes are corrected by negation and the stored
  magnitudes were in ascending order
- **THEN** the resulting `west` is the more negative of the two values
- **AND** no separate ordering correction is applied

### Requirement: Latitudes SHALL be stored in ascending order

`bounding_box.south` SHALL be less than or equal to `bounding_box.north`.
Unlike the longitudes, this admits no exception: there is no latitude
equivalent of crossing the antimeridian, so a record storing the two the other
way round SHALL have them exchanged, without reference to where the box falls.

#### Scenario: North and south transposed

- **WHEN** a record stores `{"north": 32.993, "south": 33.208}`
- **THEN** it stores `{"north": 33.208, "south": 32.993}`
- **AND** the two values are exchanged, not recomputed

#### Scenario: Exchange is applied regardless of location

- **WHEN** a record outside Arizona stores its latitudes in descending order
- **THEN** the two values are still exchanged
- **AND** no Arizona-based guard is consulted

### Requirement: Latitudes SHALL be within the valid range

`bounding_box.north` and `bounding_box.south` SHALL each be between -90 and
90 inclusive, and `south` SHALL be less than or equal to `north`.

A record violating this SHALL be reported for curatorial follow-up rather than
repaired, unless its values are a recognised transposition.

#### Scenario: Latitude slot holding a longitude value

- **WHEN** a record stores `"south": -127.745`
- **THEN** the record is listed in the quarantine report
- **AND** its coordinates are unchanged, because the true southern bound
  cannot be recovered from what is stored

### Requirement: A recognised field transposition SHALL be corrected

Where a record's coordinates are a demonstrable transposition of two slots —
each value is valid for the slot it belongs in, and reading them correctly
produces a plausible Arizona footprint — the values SHALL be exchanged.

#### Scenario: East and south transposed

- **WHEN** collection 27608 stores `{"north": 37.232, "south": -108.872,
  "east": 31.130, "west": -115.025}`
- **THEN** it stores `{"north": 37.232, "south": 31.130, "east": -108.872,
  "west": -115.025}`
- **AND** the resulting box is the extent of the state of Arizona

#### Scenario: Correction is keyed to the stored values

- **WHEN** the transposition correction runs against a record whose
  coordinates have already been corrected
- **THEN** no update is applied, because the precondition no longer holds

### Requirement: Derived geometry SHALL agree with the stored bounding box

`metadata.azgs.geom` SHALL be the envelope of the record's `bounding_box`.
It is maintained by `metadata.geom_trigger()` and SHALL NOT be written
directly by a data-repair migration.

#### Scenario: Geometry recomputed from a corrected box

- **WHEN** a record's `bounding_box` is corrected
- **THEN** its `geom` equals
  `ST_MakeEnvelope(west, south, east, north, 4326)` for the corrected values
- **AND** the migration issued no write to the `geom` column

#### Scenario: Untouched records keep their geometry

- **WHEN** a record's `bounding_box` is not altered by the migration
- **THEN** its `geom` is spatially equal to its value before the migration

### Requirement: Implausible footprints SHALL be reported, not guessed

A record whose footprint is implausible but whose correct values cannot be
derived from what is stored SHALL be listed in a quarantine report and left
unchanged. The migration SHALL NOT substitute a default extent, a statewide
box, or a null geometry.

#### Scenario: Arizona mine record at an arctic latitude

- **WHEN** collection 1671 (`Sarjac Copper Claims`, series `ADMMR`) stores a
  degenerate point at latitude 69.898 with an Arizona longitude
- **THEN** the record appears in the quarantine report
- **AND** its coordinates are unchanged

#### Scenario: Statewide map placed in the Pacific Ocean

- **WHEN** collections 15738 and 16615, both maps of the state of Arizona,
  store a box spanning -134.6 to -128.9 longitude
- **THEN** both appear in the quarantine report
- **AND** neither is reassigned the Arizona state extent, because the
  displacement is not a recognised transformation

#### Scenario: Report is produced even when empty

- **WHEN** the migration runs against a database with no implausible records
- **THEN** the quarantine report is still emitted, reporting zero rows

### Requirement: Degenerate point footprints SHALL be preserved

A bounding box where `north = south` and `east = west` describes a point
location. This is a legitimate footprint for a record whose location is known
to a single point, such as a mine or a claim, and SHALL NOT be expanded,
nulled, or reported as a defect on the grounds of zero area alone.

#### Scenario: Mine record stored as a point inside Arizona

- **WHEN** a record stores `{"north": 32.6675, "south": 32.6675,
  "east": -110.256, "west": -110.256}`
- **THEN** its coordinates are unchanged
- **AND** the record is not listed in the quarantine report

#### Scenario: Degenerate point with dropped longitude signs

- **WHEN** a record stores a degenerate point whose longitudes are both
  positive and whose negation falls inside Arizona
- **THEN** its longitudes are negated
- **AND** it remains a degenerate point

### Requirement: The repair SHALL be idempotent

Running the migration a second time against an already-repaired database SHALL
update no rows.

#### Scenario: Migration re-run after a successful run

- **WHEN** the migration runs against a database it has already repaired
- **THEN** it reports zero rows updated
- **AND** every `geom` value is spatially equal to its value before the re-run
