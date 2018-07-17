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
	which azlibConfigGDB

At this point, you should be able to run the tool like any shell command:
	azlibConfigGDB <arguments - see Usage>

If you want to be able to run the tool as a shell command and also make changes to index.js that manifest in the shell command, you need to symlink the path to our local copy of index.js. npm will do this for you:
	npm link


Usage:
------

Run the tool as follows:
  Usage: azlibConfigGDB [options]

  Options:

    -V, --version                 output the version number
    -g, --gdbschema <gdb-schema>  Geodatabase schema in DB. If a recognized schema name (e.g. ncgmp09, gems), schema will be prepped accordingly. Required
    -d, --dbname <dbname>         DB name. Required
    -u, --username <username>     DB username. Required
    -p, --password <password>     DB password (will be prompted if not included)
    -h, --help                    output usage information






