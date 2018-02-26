Installation:
-------------

At this point, you should be able to run the tool via node:
	node index.js <arguments - see Usage>

In order to install as a shell command, run:
	npm install -g

This copies the tool to a location on our path. You can see where with:
	which azlibConfigPG

At this point, you should be able to run the tool like any shell command:
	azlibConfigPG <arguments - see Usage>

If you want to be able to run the tool as a shell command and also make changes to index.js that manifest in the shell command, you need to symlink the path to our local copy of index.js. npm will do this for you:
	npm link


Usage:
------

Run the tool as follows:
	azlibConfigPG db_name db_user [db_password]

If db_password is not specified, you will be prompted for it.

Usage guidance is also available from the command line by typing:
	azlibConfigPG --help




