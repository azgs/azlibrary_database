# azlibrary_database

## Official metadata format of AZGS

This is the shape of `metadata.azgs.json_data`. It is kept in step with what is
actually stored; the counts in **Notes** were measured against `azlibrary`
(production) on 2026-11-16, over 23,898 records.

````JAVASCRIPT
{
        "title":null,
        "authors":[
                {
                "person":null,
                "organization":null,
                "givenname":null,
                "surname":null
                }],
        "collection_group": {
                "id":null,
                "name":null
                },
        "year": null,
        "journal": {
                "name":null,
                "publisher":null,
                "url":null
                },
        "series":null,
        "abstract":null,
        "links":[
                {
                "url":null,
                "name":"AZGS old"},
                {"url":null,
                "name":"UA Library"}
                ],
        "identifiers":{
                "perm_id":null,
                "collection_id":null,
                "doi":null,
                "supersedes":[],
                "superseded_by":[]
                },
        "files":[
                {"name":null,
                "type":null}
                ],
        "language":"English",
        "license":{
                "type":"CC BY-SA 4.0",
                "url":"https://creativecommons.org/licenses/by-sa/4.0/"
                },
        "keywords":[
                {"name":null,
                "type":null}
                ],
        "informal_name":null,
        "mine_data":{
                "collection":null,
                "resource_id":null,
                "start_date":null,
                "end_date":null
                },
        "bounding_box":{
                "north":null,
                "south":null,
                "east":null,
                "west":null},
        "private":false
}
````

## Notes

**`bounding_box`** holds four JSON numbers, never strings. Longitudes carry the
sign of their hemisphere, so Arizona's are negative — roughly -109 to -115.
`west` is at or below `east` and `south` at or below `north`. The one exception
is an extent that crosses the antimeridian, where `west` is near -180 and
`east` near +180; 19 records are like that. A box where `north` equals `south`
and `east` equals `west` is a point location, which is the honest footprint for
a mine or claim record, and 14,609 records use one.

`metadata.azgs.geom` is derived from `bounding_box` by
`metadata.geom_trigger()`, which evaluates
`ST_MakeEnvelope(west, south, east, north, 4326)` on every insert and update.
Nothing else writes `geom`, and it must not be written directly: the trigger
would overwrite it in the same statement.

**`year`** is a JSON number, or `null` when the year is unknown. Never a string.

**`private`** is a JSON boolean, not the string `"false"`.

**`license`** is `CC BY-SA 4.0` on every record. The collection was relicensed
from `CC BY-NC-SA 4.0` in 2026; the non-commercial clause was never correct.

**`journal`** is retired. It is present on every record with all three
subfields `null`, so the stored shape still matches this document, but it holds
no bibliographic data anywhere in the collection and nothing should be written
to it.

**`keywords[].type`** is one of `place`, `theme` or `temporal`. `time` was
folded into `temporal`; one concept, one term. Names are trimmed, and a
`(name, type)` pair appears at most once per record.

**`links[].name`** is either `AZGS old` or `UA Library`. There is no `doi` link
entry — a DOI belongs in `identifiers.doi`.

**`identifiers.perm_id`** is the permanent identifier and is always present;
it is what the API returns as `collection_id`. `identifiers.collection_id` and
`identifiers.doi` are structural placeholders and are null on every record that
carries them. `supersedes` and `superseded_by` are arrays of `perm_id`, present
only on records in a supersession chain.

**`mine_data`** is present on records belonging to a mine collection — 20,633
of them. `collection` and `resource_id` are always set when the object is
present; `start_date` and `end_date` on about 8,600.

**Optional keys.** `series`, `keywords`, `language`, `abstract` and
`informal_name` may be absent from a record rather than present and null, so
read them defensively. `informal_name` was meant to hold shortened titles for
mobile clients that were never built: it is optional, largely unpopulated and
unread.

## Migrations

Schema and data migrations live in `migrations/`. See `migrations/README.md`
for how they are run and the conventions they follow.
