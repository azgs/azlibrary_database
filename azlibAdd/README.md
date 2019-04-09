# Prerequisites

This command line tool relies on the gdal npm package (https://www.npmjs.com/package/gdal). At the time of this writing, the gdal package is not compatibile with the latest version of node.js (9.5.0). It works fine the the current LTS release (8.9.4). If you need to install this version, you can use nvm to manage multiple node versions as follows:

	1. curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
	2. nvm --version  (to verify install)
	3. nvm install 8.9.4
	4. nvm use 8.9.4



# Installation

At this point, you should be able to run the tool via node:

	node index.js <arguments - see Usage>

In order to install as a shell command, run:
	
	npm install -g

This copies the tool to a location on our path. You can see where with:
	
	which azlibAdd

At this point, you should be able to run the tool like any shell command:
	
	azlibAdd <arguments - see Usage>

If you want to be able to run the tool as a shell command and also make changes to index.js that manifest in the shell command, you need to symlink the path to our local copy of index.js. npm will do this for you:
	
	npm link


# Usage

Run the tool as follows:

	Usage: azlibAdd [options]

	  Options:

		-V, --version                                output the version number
		-s, --source <source>                        Source directory of the collection(s). Required
		-d, --dbname <dbname>                        DB name. Required
		-u, --username <username>                    DB username. Required
		-p, --password <password>                    DB password (will be prompted if not included)
		-P, --private                                Indicates if this is a private collection.
		-a, --archive [archive_directory]            Indicates whether to archive the source directory into a tar.gz. If archive is present but archive_directory is not, defaults to source directory.
		-f, --failure_directory <failure_directory>  Directory to move failed uploads to. Default is to leave in source directory.
		-U, --unrecOK                                Indicates whether to allow unrecognized files in gdb schemas.
		-l, --loglevel <loglevel>                    Indicates logging level (error, warn, info, verbose, debug, silly). Default is info. (default: info)
		-r, --repeat                                 Indicates that the source directory contains multiple collections source directories.
		-h, --help                                   output usage information


# Source directory format

The source directory must be in the following layout (note: this is still evolving):

	<dir name>
		|
		|-- azgs.json*8
		|
		|-- [metadata]
		|	|
		|	|-- [<type*1>-<name*2>.xml] (0..N)
		|
		|--[notes]
		|	|
		|	|-- [metadata]
		|	|	|
		|	|	|-- [<type*1>-<name*2>.xml] (0..N)
		|	|
		|	|-- [<name>[.<extension>]]*5 (0..N)
		|	
		|-- [documents]
		|	|
		|	|-- [metadata]
		|	|	|
		|	|	|-- [<type*1>-<name*2>.xml] (0..N)
		|	|
		|	|-- [<name>.txt] (0..N)
		|	|
		|	|-- [<name>.pdf] (0..N)
		|	|
		|	|-- [<name>.rtf] (0..N)
		|	|
		|	|-- [<name>.doc] (0..N)
		|	|
		|	|-- [<name>.docx] (0..N)
		|
		|-- [images]
		|	|
		|	|-- [metadata]
		|	|	|
		|	|	|-- [<type*1>-<name*2>.xml] (0..N)
		|	|
		|	|-- [<name>.tiff or <name>.tif] (0..N)
		|	|
		|	|-- [<name>.jpg] (0..N)
		|	|
		|	|-- [<name>.png] (0..N)
		|	|
		|	|-- [<name>.gif] (0..N)
		|	|
		|	|-- [<name>.tiff or <name>.tif] (0..N)
		|
		|--[gisdata]
			|
			|--	[metadata]
			|	|
			|	|-- [<type*1>-<name*2>.xml] (0..N) 
			|	
			|-- [layers]*3
			|	|
			|	|--	[metadata]
			|	|	|
			|	|	|-- [<type*1>-<name*2>.xml] (0..N) 
			|	|
			|	|-- [<name>.geojson] (0..N)
			|	|
			|	|-- [<name>.json] (0..N)
			|	|
			|	|-- [<name>.kml] (0..N)
			|	|
			|	|-- [<name>.shp] (0..N)
			|		|
			|		|-- the various files for a single shapefile (must include one with .shp extention)
			|
			|-- [raster]
			|	|
			|	|--	[metadata]
			|	|	|
			|	|	|-- [<type*1>-<name*2>.xml] (0..N) 
			|	|
			|	|-- [<name>.tiff or <name>.tif] (0..N)
			|
			|-- [legacy]*7
			|	|
			|	|--	[metadata]
			|	|	|
			|	|	|-- [<type*1>-<name*2>.xml] (0..N) 
			|	|
			|	|-- [<name>.<extension>] (0..N)
			|	
			|-- [<schema name>]\*6
				|
				|--	[metadata]
				|	|
				|	|-- [<type\*1>-<name\*4>.xml] (0..N) 
				|
				|-- <name>.gdb (0..N)



\*1 type = "FGDC", "ISO19139", or "ISO19115"

\*2 If metadata is associated with a specific file, <name> should correspond to a that file (sans extension) in the directory.

\*3 Other legacy formats may work. If format is recognized, software will attempt to determine a bounding box around the data and store this in the db.
		
\*4 If metadata is associated with a specific geodatabase, <name> should correspond to a gdb subdirectory (sans extension) in the directory.

\*5 Notes is basically a garbage can for stuff that doesn't fit elsewhere. As such, any type of file could be here. We only store the path in the db.

\*6 This is for geodatabases only. The schema name must be created manually and must already exist in the db prior to running this script.

\*7 This is a catch-all directory for any other weird gis files. 

\*8 azgs.json is required and contains the key metadata for the collection. It's format is documented below.


# azgs.json format

	{
		"title": "",
		"authors": [
			"person": null,
			"organization": null,
			"givenname": null,
			"surname": null
		],
		"collection_group": {
			"name": ""
		},
		"year": "",
		"journal": {
			"name": null,
			"publisher": null,
			"url": null
		},
		"series": null,
		"abstract": "", 
		"links": [
			{
				"url": "",
				"name": "AZGS old"
			}
		],
		"identifiers": {
			"perm_id": null,
			"directory": null,
			"doi": null
		},
		"files": [
			{
				"name": "",
				"extension": "",
				"type": ""
			}
		],
		"language": "English",
		"license": {
			"type": "CC BY-NC-SA 4.0",
			"url": "https://creativecommons.org/licenses/by-nc-sa/4.0/"
		},
		"keywords": [
			{
				"name": "",
				"type": ""
			}
		],
		"informal_name": null,
		"bounding_box": {
			"north": "",
			"south": "",
			"east": "",
			"west": ""
		},
		"private": "false"
	}

# Collection identification

## Upload ID

All attempted imports will have a record in the uploads table. Thus, they will be assigned an upload ID. This record and its ID will exist whether the import succeeds or not.

## Permanent collection ID

When a new collection is sucessfully imported, it is assigned a permanent ID (perm\_id). This perm\_id is of the following format:
```
<collection group acronym>-<epoch time milliseconds>-<random number between 0 and 1000>
```

# Output directories

## Archive

If an archive directory is specified, each collection processed is tar.gz'd into a file bearing the collection's perm_id and moved into the archive directory. If no archive directory is specified, the collection directories are left in place.

## Failures

Except for the creation of the upload record, all of the db work for an import takes place in a transaction. This insures that any problems encountered during import result in the db being rolled back to its previous state. (Note: We use ogr2ogr for gdb processing. It's interaction with the database takes place outside of the import transaction. Special handling during error recovery insures that artifacts of this processing are rolled back as well.) The only artifact left in the database is the upload record for this attempt.

When a collection fails to import, a failure.json file is created in its directory containing data on what happened.

If a failure directory is specified, the directories of collections that fail during import are renamed to the upload ID of the import attempt and moved to this directory. If no failure directory is specified, the directories of failed collections are left in place.

