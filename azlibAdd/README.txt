Prerequisites:
--------------

This command line tool relies on the gdal npm package (https://www.npmjs.com/package/gdal). At the time of this writing, the gdal package is not compatibile with the latest version of node.js (9.5.0). It works fine the the current LTS release (8.9.4). If you need to install this version, you can use nvm to manage multiple node versions as follows:

	1) curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash
	2) nvm --version  (to verify install)
	3) nvm install 8.9.4
	4) nvm use 8.9.4



Installation:
-------------

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


Usage:
------

Run the tool as follows:
	azlibAdd source_directory gdb_schema_name db_name db_user [db_password]

If db_password is not specified, you will be prompted for it.

Usage guidance is also available from the command line by typing:
	azlibAdd --help


Source directory format:
------------------------

The source directory must be in the following layout (note: this is still evolving):

<dir name>
	|
	|-- metadata
	|	|
	|	|-- 0..n xml files with naming format <type>-<name>.xml
	|	|
	|	|-- 0..n json files with naming format <type>-<name>.json
	|
	|--notes
	|	|
	|	|-- <TBD>
	|	
	|-- documents
	|	|
	|	|-- <TBD>
	|
	|-- images
	|	|
	|	|-- <TBD>
	|
	|--geodata
		|
		|--<schema name> or "legacy"
			|
			|-- if not "legacy" then <dir name>.gdb
			|			OR
			|-- if "legacy" then whatever (shp, etc.)
				note: if format is recognized, software will attempt to determine a
				bounding box around the data and store this in the db


