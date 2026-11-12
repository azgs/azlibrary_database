## Purpose

Defines the JSON type and value invariants that every stored
`metadata.azgs.json_data` record satisfies, so that consumers can read a field
without probing its type or trimming its value first.

## ADDED Requirements

### Requirement: Bounding box coordinates SHALL be JSON numbers

Each of `bounding_box.north`, `bounding_box.south`, `bounding_box.east` and
`bounding_box.west` SHALL be stored as a JSON number. A record SHALL NOT store
a coordinate as a quoted string, and SHALL NOT carry leading or trailing
whitespace in a coordinate value.

#### Scenario: Coordinate previously stored as a quoted string
- **WHEN** a record stored `"north": "33.100000"`
- **THEN** it stores `"north": 33.100000` as a JSON number
- **AND** `jsonb_typeof(json_data->'bounding_box'->'north')` returns `number`

#### Scenario: Coordinate string carried surrounding whitespace
- **WHEN** a record stored `"east": " -114.598610"` with a leading space
- **THEN** it stores `"east": -114.598610` as a JSON number

#### Scenario: Derived geometry is unchanged
- **WHEN** the coordinates of a record are converted from string to number
- **THEN** the `geom` column for that record is spatially equal to its value
  before the conversion

### Requirement: Publication year SHALL be a JSON number or null

`year` SHALL be stored as a JSON number when a publication year is known, and
as JSON `null` when it is not. A record SHALL NOT store `year` as a quoted
string, including the empty string.

#### Scenario: Year previously stored as a numeric string
- **WHEN** a record stored `"year": "1928"`
- **THEN** it stores `"year": 1928` as a JSON number

#### Scenario: Year previously stored as an empty string
- **WHEN** a record stored `"year": ""`
- **THEN** it stores `"year": null`
- **AND** the record is not assigned a substitute year such as `0`

### Requirement: Journal SHALL be empty on every record

`journal` SHALL be the object `{"name": null, "publisher": null, "url": null}`
on every record. The field holds no legitimate bibliographic data anywhere in
the collection and is retired in place rather than removed, so that the stored
shape still matches the documented format. Where a record's `journal` is a bare
string, that text SHALL first be moved onto the end of the record's `abstract`,
so that no text is discarded without being preserved elsewhere.

#### Scenario: Journal holds citation boilerplate and the record has no abstract
- **WHEN** a record stores `"journal": "Please cite by using: [a description of the item]. 1960-01-0063-img-01, ..."` and has no `abstract` key
- **THEN** its `abstract` is that boilerplate text
- **AND** its `journal` is `{"name": null, "publisher": null, "url": null}`

#### Scenario: Journal holds citation boilerplate and the record has an abstract
- **WHEN** a record stores a bare `journal` string and an `abstract` with existing text
- **THEN** its `abstract` is the original text followed by the boilerplate text
- **AND** its `journal` is `{"name": null, "publisher": null, "url": null}`

#### Scenario: Journal object duplicates a link the record already holds
- **WHEN** a record stores `"journal": {"url": "", "name": "AZGS Old", "publisher": ""}` and already has an `AZGS old` entry in `links` with a real URL
- **THEN** its `journal` is emptied
- **AND** its `links` array is left unchanged, gaining no duplicate entry

#### Scenario: Journal object holds a publisher name
- **WHEN** a record stores `"journal": {"name": "Arizona Geological Survey"}`
- **THEN** its `journal` is emptied
- **AND** the value is recoverable from the migration's backup table

#### Scenario: Record has no journal key
- **WHEN** a record has no `journal` key at all
- **THEN** it gains `"journal": {"name": null, "publisher": null, "url": null}`

#### Scenario: Migration is applied twice
- **WHEN** the transformation runs a second time against already-migrated data
- **THEN** no abstract gains a second copy of the boilerplate text
- **AND** no `journal` value changes

### Requirement: Keyword names SHALL be trimmed and non-empty

Every `keywords[].name` SHALL have no leading or trailing whitespace. An entry
whose name is empty after trimming SHALL NOT be present in the array.

#### Scenario: Keyword name carried a leading space
- **WHEN** a record contained `{"name": " mineral resources", "type": "theme"}`
- **THEN** it contains `{"name": "mineral resources", "type": "theme"}`

#### Scenario: Keyword name is empty after trimming
- **WHEN** a record contained `{"name": "   ", "type": "theme"}`
- **THEN** that entry is absent from the `keywords` array
- **AND** the remaining keyword entries are unchanged

### Requirement: Keyword entries SHALL be unique within a record

Within one record, the `keywords` array SHALL NOT contain two entries with the
same `(name, type)` pair after trimming. The first occurrence SHALL be retained
and later duplicates dropped, preserving the relative order of the entries that
remain.

#### Scenario: Same keyword repeated in one record
- **WHEN** a record's keywords contain `{"name": "Specimens", "type": "theme"}` three times
- **THEN** the record contains that entry exactly once

#### Scenario: Entries differing only by untrimmed whitespace
- **WHEN** a record contains `{"name": "Zinc", "type": "theme"}` and `{"name": " Zinc", "type": "theme"}`
- **THEN** the record contains `{"name": "Zinc", "type": "theme"}` exactly once

#### Scenario: Same name under two different types
- **WHEN** a record contains `{"name": "Arizona", "type": "place"}` and `{"name": "Arizona", "type": "theme"}`
- **THEN** both entries are retained, because their `(name, type)` pairs differ

### Requirement: Keyword types SHALL use a single controlled vocabulary

`keywords[].type` SHALL be one of `place`, `theme` or `temporal`. The value
`time` SHALL NOT be used; it denotes the same concept as `temporal`.

#### Scenario: Keyword typed as time
- **WHEN** a record contains `{"name": "1920s", "type": "time"}`
- **THEN** it contains `{"name": "1920s", "type": "temporal"}`

#### Scenario: Collapsing type creates a duplicate
- **WHEN** a record contains `{"name": "1920s", "type": "time"}` and `{"name": "1920s", "type": "temporal"}`
- **THEN** the record contains `{"name": "1920s", "type": "temporal"}` exactly once

### Requirement: Mine collection names SHALL be trimmed

`mine_data.collection` SHALL have no leading or trailing whitespace, so that
two records naming the same collection compare equal.

#### Scenario: Collection name carried trailing whitespace
- **WHEN** records stored `"collection": "A. F. Budge mining Ltd. "` and `"collection": "A. F. Budge mining Ltd."`
- **THEN** both store `"collection": "A. F. Budge mining Ltd."`
- **AND** grouping by `mine_data.collection` yields one group for that name

### Requirement: Link names SHALL use canonical values

Every `links[].name` SHALL be one of the canonical values `AZGS old` or
`UA Library`. Casing and spelling variants SHALL NOT be stored.

#### Scenario: Link name uses a casing variant
- **WHEN** a record stored `{"name": "AZGS Old", "url": "https://..."}`
- **THEN** it stores `{"name": "AZGS old", "url": "https://..."}`
- **AND** the `url` value is unchanged

#### Scenario: Link name uses an unrecognized spelling
- **WHEN** a record stored a link named `repository` or `AZGS Repository`
- **THEN** it stores that link under the canonical name `AZGS old`

### Requirement: Records SHALL use the documented key names

A record SHALL use the key `authors` for its author list and `informal_name`
for its informal name. The misspelled keys `author` and `informalname` SHALL
NOT be present. Correcting a misspelled key SHALL preserve its value and SHALL
NOT remove the record.

#### Scenario: Record carries the misspelled key informalname
- **WHEN** a record has `"informalname": "OFR-26-5"` and no `informal_name` key
- **THEN** it has `"informal_name": "OFR-26-5"` and no `informalname` key
- **AND** the record remains in the table with its other fields unchanged

#### Scenario: Misspelled key holds an empty value
- **WHEN** a record has `"informalname": ""` and no `informal_name` key
- **THEN** it has `"informal_name": null` and no `informalname` key
- **AND** no empty string is introduced, since `null` is the documented
  representation of an absent informal name

#### Scenario: Record carries the misspelled key author
- **WHEN** a record has an `author` array and no `authors` key
- **THEN** that array is stored under `authors` and the `author` key is absent

#### Scenario: Correct key already present
- **WHEN** a record has both the misspelled key and the correctly spelled key
- **THEN** the correctly spelled key's value is retained
- **AND** the misspelled key is removed without overwriting it

#### Scenario: No record retains a misspelled key
- **WHEN** the migration has completed
- **THEN** no row satisfies `json_data ? 'author'` or `json_data ? 'informalname'`

### Requirement: Every record SHALL assert the CC BY-SA 4.0 license

Every record SHALL carry a `license` object whose `type` is `CC BY-SA 4.0` and
whose `url` is `https://creativecommons.org/licenses/by-sa/4.0/`. The
NonCommercial (`NC`) term SHALL NOT appear in any stored license, because it
does not reflect the terms AZGS material is released under.

#### Scenario: Record asserts the superseded NonCommercial license
- **WHEN** a record stores `{"type": "CC BY-NC-SA 4.0", "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"}`
- **THEN** it stores `{"type": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/"}`

#### Scenario: Record has a blank or absent license
- **WHEN** a record has no `license` key, or a `license` whose `type` and `url` are null or empty
- **THEN** it stores the full `CC BY-SA 4.0` license object

#### Scenario: No record retains NonCommercial terms
- **WHEN** the migration has completed
- **THEN** no row has a `license.type` or `license.url` containing `nc` or `NC`
- **AND** all 23,003 rows have `license.type = 'CC BY-SA 4.0'`
