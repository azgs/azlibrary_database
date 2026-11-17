## MODIFIED Requirements

### Requirement: Every record SHALL assert the CC BY-SA 4.0 license

Every record SHALL carry a `license` object whose `type` is `CC BY-SA 4.0` and
whose `url` is `https://creativecommons.org/licenses/by-sa/4.0/`. The
NonCommercial (`NC`) term SHALL NOT appear in any stored license, because it
does not reflect the terms AZGS material is released under.

This SHALL hold of every record at every moment, not only of records present
when a migration ran. It SHALL hold however the record was written — by an
ingest tool, a conversion script, a bulk load or a hand-written statement —
and the database SHALL reject a write that would violate it rather than
storing it and relying on a later sweep to find it.

Any tool that composes a metadata record SHALL use the current license, and
SHALL NOT carry the superseded value as a default, an example or a template.

#### Scenario: Record asserts the superseded NonCommercial license
- **WHEN** a record stores `{"type": "CC BY-NC-SA 4.0", "url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"}`
- **THEN** it stores `{"type": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/"}`

#### Scenario: Record has a blank or absent license
- **WHEN** a record has no `license` key, or a `license` whose `type` and `url` are null or empty
- **THEN** it stores the full `CC BY-SA 4.0` license object

#### Scenario: No record retains NonCommercial terms
- **WHEN** the repair has completed
- **THEN** no row has a `license.type` or `license.url` containing `nc` or `NC`
- **AND** every row has `license.type = 'CC BY-SA 4.0'`

#### Scenario: A write carrying the superseded license
- **GIVEN** the invariant is enforced
- **WHEN** any client attempts to write a record whose license asserts NonCommercial terms
- **THEN** the write is rejected
- **AND** the record is not stored

#### Scenario: A newly ingested collection
- **GIVEN** a collection ingested after this change
- **WHEN** its stored record is read
- **THEN** its license is `CC BY-SA 4.0`
- **AND** no step was needed to correct it after ingest

#### Scenario: A tool's default template
- **WHEN** any ingest or conversion tool composes a new metadata record
- **THEN** the license it writes is the current one
- **AND** no superseded license string remains in that tool's code or its documented examples
