azlibConvert is a command line tool used to generate azgs.json files from ISO19115 and ISO19139 xml.

# Installation

At this point, you should be able to run the tool via node:

	node index.js <arguments - see Usage>

In order to install as a shell command, run:
	
	npm install -g

This copies the tool to a location on our path. You can see where with:
	
	which azlibConvert

At this point, you should be able to run the tool like any shell command:
	
	azlibConvert <arguments - see Usage>

If you want to be able to run the tool as a shell command and also make changes to index.js that manifest in the shell command, you need to symlink the path to our local copy of index.js. npm will do this for you:
	
	npm link


# Usage

Run the tool as follows:

	Usage: azlibConvert [options]

	Options:
	  -V, --version              output the version number
	  -s, --source <source>      Source directory of the collection(s). Required
	  -l, --loglevel <loglevel>  Indicates logging level (error, warn, info, verbose, debug, silly). Default is info. (default: "info")
	  -r, --repeat               Indicates that the source directory contains multiple collections source directories.
	  -o, --old_dbname <dbname>  Old DB name. Optional. This is only used if there are existing entries for UA_library and informal_name to be brought forward from a previous run. This was for a special use case and will likely be deprecated soon.
	  -n, --new_dbname <dbname>  New DB name. Optional. Used to fetch collection group name based on azgs_old_url. This was for a special use case and will likely be deprecated soon.
	  -u, --username <username>  DB username. Required if -o or -n specified.
	  -p, --password <password>  DB password (will be prompted if not included)
	  -h, --help                 output usage information

#Input

Each collection to be processed must have a directory called "metadata" in its top level. Inside that directory, there must be a file called either ISO19115.xml or ISO19139.xml (not case sensative).

# Output

Output is a file called azgs.json in the top level directory of the each collection processed. This file contains relevant data parsed from the xml.

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



