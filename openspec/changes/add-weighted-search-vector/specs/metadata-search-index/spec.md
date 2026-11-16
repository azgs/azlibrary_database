## Purpose

Defines the derived full-text search surface over `metadata.azgs`: which parts
of `json_data` are searchable, how strongly each contributes to a relevance
score, and the guarantee that the surface tracks `json_data` without any
explicit reindex step.

## ADDED Requirements

### Requirement: A single composite search vector SHALL cover every searchable metadata field

`metadata.azgs` SHALL carry a `kitchensink_search` column of type `tsvector`
holding one composite vector per record, built from `title`,
`keywords[].name`, `authors[].person`, `series` and `abstract`. A record SHALL
contribute every one of those fields that it holds, and a record missing any of
them SHALL still produce a vector from the fields it does hold.

#### Scenario: Record holds every searchable field
- **WHEN** a record holds a title, keywords, authors, a series and an abstract
- **THEN** `kitchensink_search` contains lexemes drawn from all five fields

#### Scenario: Record holds only a title
- **WHEN** a record holds a title and has no keywords, authors, series or abstract
- **THEN** `kitchensink_search` contains the lexemes of the title
- **AND** the column is not null

#### Scenario: Abstract text becomes searchable
- **WHEN** a record's abstract contains a word that appears in no other field
- **THEN** `kitchensink_search` contains that word's lexeme
- **AND** a `tsquery` for that word matches the record

#### Scenario: Record holds no searchable text at all
- **WHEN** a record holds none of the five fields
- **THEN** `kitchensink_search` is the empty `tsvector`
- **AND** the column is not null

### Requirement: Field contributions SHALL be weighted by descriptive strength

Each field SHALL contribute at a fixed `tsvector` weight: `title` at `A`,
`keywords[].name` at `B`, `authors[].person` and `series` at `C`, and
`abstract` at `D`. A term matching a record's title SHALL therefore rank that
record above a record where the same term matches only its abstract, under
`ts_rank_cd` with default weights.

#### Scenario: Title hit outranks abstract hit
- **GIVEN** record X holds the term in its title and record Y holds it only in its abstract
- **WHEN** both are ranked with `ts_rank_cd(kitchensink_search, <tsquery>)`
- **THEN** record X ranks above record Y

#### Scenario: Keyword hit outranks author hit
- **GIVEN** record X holds the term in `keywords[].name` and record Y holds it only in `authors[].person`
- **WHEN** both are ranked with `ts_rank_cd(kitchensink_search, <tsquery>)`
- **THEN** record X ranks above record Y

#### Scenario: Weights are recorded in the vector itself
- **WHEN** a lexeme originates in a record's title
- **THEN** its position in `kitchensink_search` carries weight `A`

### Requirement: The search vector SHALL be maintained without an explicit reindex

`kitchensink_search` SHALL be a column the database computes from `json_data`,
so that no caller, ingest path or migration has to write it, and no stored
vector can disagree with the `json_data` it was derived from.

#### Scenario: New collection is ingested
- **WHEN** `azlibAdd` inserts a row into `metadata.azgs`
- **THEN** `kitchensink_search` is populated for that row without the inserting code referring to the column

#### Scenario: Metadata is edited through the API
- **WHEN** a `PATCH` updates a record's `json_data` to add a word to its abstract
- **THEN** `kitchensink_search` for that record contains the new word's lexeme immediately after the update commits

#### Scenario: Caller attempts to write the column directly
- **WHEN** a statement tries to assign a value to `kitchensink_search`
- **THEN** the statement is rejected

### Requirement: The search vector SHALL use an explicitly named text search configuration

Every `to_tsvector` call building `kitchensink_search` SHALL name
`pg_catalog.english` explicitly rather than relying on the session or server
`default_text_search_config`, so that the stored vector cannot vary with server
configuration and always agrees with the queries the API issues.

#### Scenario: Server default differs from english
- **GIVEN** a server whose `default_text_search_config` is not `pg_catalog.english`
- **WHEN** a record is inserted
- **THEN** its `kitchensink_search` is stemmed as English
- **AND** it matches a `plainto_tsquery('pg_catalog.english', ...)` for a stemmed form of one of its words

### Requirement: Introducing the composite vector SHALL NOT alter existing search behaviour

The four populated per-field vectors — `title_search`, `author_search`,
`keyword_search` and `series_search` — and the triggers that maintain them
SHALL be unchanged, so that every query reading them returns what it returned
before. No record's `json_data` SHALL be modified.

#### Scenario: Per-field vectors are untouched
- **WHEN** the composite vector is introduced
- **THEN** each record's `title_search`, `author_search`, `keyword_search` and `series_search` are byte-for-byte what they were beforehand

#### Scenario: Source data is untouched
- **WHEN** the composite vector is introduced
- **THEN** every record's `json_data` and `geom` are unchanged

#### Scenario: No searchable data is discarded
- **GIVEN** `kitchensink_search` holds no value on any record beforehand
- **WHEN** the column is replaced by its generated equivalent
- **THEN** no record loses a stored vector
