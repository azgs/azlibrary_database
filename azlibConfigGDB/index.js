#!/usr/bin/env node


global.args = require('commander');

args
	.version('0.0.1')
	//.option('-s, --source <source>', 'Source directory of the gdb. Required')
	.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. If a recognized schema name (e.g. ncgmp09, gems), schema will be prepped accordingly. Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	.option('-c, --create ', 'Create schema but do not load it (used for temporary schemas when importing collections)')
	.parse(process.argv);

const pgp = require("pg-promise")({
	// Initialization Options
});
let db;

const path = require("path");

//TODO: Kind of cheesy to have to do this to get path to this folder. Is there a better way?
const pathToMe = require("global-modules-path").getPath("azlibConfigGDB");

// get password sorted
let promise = new Promise((resolve) => {
	if (args.length === 4) {
		const prompt = require('prompt');
	  	prompt.message = "";
	  	prompt.delimiter = "";
		prompt.start();
		prompt.get([{
			name: 'postgres password',
		    hidden: true,
			replace: '*'
		}], (err, result) => {
			resolve(result['postgres password']);
		});
	} else {
		resolve(args.password);
	}
});


promise.then((password) => {
	args.password = password;
	//console.log("args.password = " + argspassword);

	const cn = 'postgres://' + args.username + ':' + args.password + '@localhost:5432/' + args.dbname;
	db = pgp(cn);

	//create schema
	return db.none('create schema ' + args.gdbschema).catch(error => {throw new Error(error);});
}).then(() => {
	if (args.create) {
		return Promise.resolve(); //We're done in this case
	}

	//TODO: Currently using the same template for ncgmp09 and gems. This is not accurate and will change in the future.
	if (args.gdbschema.toLowerCase() === "ncgmp09" || args.gdbschema.toLowerCase() === "gems") {

		const file = pgp.QueryFile(path.join(pathToMe, 'ncgmp09', 'ncgmp09.sql'), {minify: true, params: args.gdbschema});

		return db.none(file).catch(error => {
			console.log("Problem processing ncgmp09 template: ");console.log(error); 
			throw new Error(error);
		});
	} else {
		//TODO: Also using same template for everything else
		const file = pgp.QueryFile(path.join(pathToMe, 'ncgmp09', 'ncgmp09.sql'), {minify: true, params: args.gdbschema});

		return db.none(file).catch(error => {
			console.log("Problem processing ncgmp09 template: ");console.log(error); 
			throw new Error(error);
		});
	}
}).then(() => {
	console.log("Schema created");
	pgp.end();
})
.catch(error => { 
	console.log(error);
	pgp.end();
	process.exit(1);
});
	
			





