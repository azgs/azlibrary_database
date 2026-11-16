# document-text-index Specification

## Purpose
Defines the full-text index over extracted document text in
`documents.documents.text_search`: the text search configuration it is built
with, and the guarantee that a document is findable by the same queries the API
issues, regardless of how the server happens to be configured.

## Requirements

### Requirement: Document text SHALL be indexed under an explicitly named configuration

Every write to `documents.documents.text_search` SHALL name
`pg_catalog.english` explicitly. No write SHALL rely on the server or session
`default_text_search_config`, so that the stored vector cannot vary with server
configuration between one ingest and the next.

#### Scenario: Server default is not english
- **GIVEN** a server whose `default_text_search_config` is `pg_catalog.simple`
- **WHEN** a collection containing a document is ingested
- **THEN** that document's `text_search` is stemmed as English
- **AND** it holds no English stopword lexeme

#### Scenario: Server default is changed between two ingests
- **GIVEN** two documents of identical text ingested under different server defaults
- **WHEN** both have been indexed
- **THEN** their `text_search` values are equal

### Requirement: The stored index SHALL match the queries issued against it

A document whose extracted text contains a word SHALL be found by a
`plainto_tsquery('pg_catalog.english', ...)` for any inflected form of that
word, because the API issues exactly those queries.

#### Scenario: Inflected form of an indexed word
- **GIVEN** a document whose text contains "geological"
- **WHEN** the API searches for "geology"
- **THEN** the document matches

#### Scenario: Phrase search over an indexed document
- **GIVEN** a document whose text contains the phrase "arizona geological survey"
- **WHEN** the API issues `phraseto_tsquery('pg_catalog.english', 'arizona geological survey')`
- **THEN** the document matches

### Requirement: Mis-indexed documents SHALL be repaired from the stored vector

Documents already indexed under the wrong configuration SHALL be repaired
without re-extracting text from any source file, by reconstructing their word
sequence from the positions stored in the existing `tsvector` and re-tokenizing
it under `pg_catalog.english`.

#### Scenario: Document indexed under simple
- **GIVEN** a document whose `text_search` holds `geological` and the stopword `the`
- **WHEN** the repair runs
- **THEN** its `text_search` holds the lexeme `geolog`
- **AND** it holds no English stopword lexeme
- **AND** it matches a `plainto_tsquery('pg_catalog.english', 'geological')`

#### Scenario: Word order within the recoverable range
- **GIVEN** a document whose highest stored lexeme position is below 16,383
- **WHEN** the repair runs
- **THEN** its reconstructed word order is the original word order
- **AND** phrase queries over it match as they would for a correctly indexed document

#### Scenario: Document beyond the position cap
- **GIVEN** a document whose stored positions reach the `tsvector` cap of 16,383
- **WHEN** the repair runs
- **THEN** its stemming is corrected like any other document
- **AND** no claim is made about word order beyond the cap, which the stored
  vector does not record and the repair cannot invent

### Requirement: The repair SHALL leave correctly indexed documents untouched

A document already indexed under `pg_catalog.english` SHALL NOT be rewritten,
so that the repair touches only the rows it needs to and can be re-run safely.

#### Scenario: Already-correct document
- **WHEN** the repair runs over a document holding no English stopword lexeme
- **THEN** that document's `text_search` is unchanged

#### Scenario: Repair is re-run
- **WHEN** the repair is run a second time against an already-repaired database
- **THEN** no row is modified

### Requirement: The repair SHALL NOT alter anything but the index

No column other than `documents.documents.text_search` SHALL be written, and no
document row SHALL be added or removed.

#### Scenario: Row inventory is preserved
- **WHEN** the repair has completed
- **THEN** `documents.documents` holds exactly the rows it held beforehand
- **AND** every `document_id`, `collection_id`, `metadata_id` and `path` is unchanged
