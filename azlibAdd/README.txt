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
		|-- [legacy]*3
		|	|
		|	|--	[metadata]
		|	|	|
		|	|	|-- [<type*1>-<name*2>.xml] (0..N) 
		|	|
		|	|-- [<name>.geojson] (1..N)
		|	|
		|	|-- [<name>.json] (1..N)
		|	|
		|	|-- [<name>.kml] (1..N)
		|	|
		|	|-- [<name>.shp] (1..N)
		|		|
		|		|-- the various files for a single shapefile (must include one with .shp extention)
		|
		|-- [raster]
		|	|
		|	|--	[metadata]
		|	|	|
		|	|	|-- [<type*1>-<name*2>.xml] (0..N) 
		|	|
		|	|-- [<name>.tiff or <name>.tif] (1..N)
		|
		|-- [<schema name>]*6
			|
			|--	[metadata]
			|	|
			|	|-- [<type*1>-<name*4>.xml] (0..N) 
			|
			|-- <name>.gdb (1..N)



*1 type = "FGDC" or "ISO19139"
*2 If metadata is associated with a specific file, <name> should correspond to a that file (sans extension) in the directory.
*3 Other legacy formats may work. If format is recognized, software will attempt to determine a bounding box around the data and store this in the db		
*4 If metadata is associated with a specific geodatabase, <name> should correspond to a gdb subdirectory (sans extension) in the directory.
*5 Notes is basically a garbage can for stuff that doesn't fit elsewhere. As such, any type of file could be here. We only store the path in the db.
*6 This is for geodatabases only. The schema name must be created manually and must already exist in the db prior to running this script.




