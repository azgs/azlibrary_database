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

	//TODO: The gems sql file is a placeholder. Real one is in development.
	const schemaFile = args.gdbschema.toLowerCase() === "ncgmp09" ?
						"ncgmp09.sql" :
						args.gdbschema.toLowerCase() === "gems" ?
							"gems.sql" :
							null;
	if (schemaFile) {
		const pgpFile = pgp.QueryFile(path.join(pathToMe, 'schemas', schemaFile), {minify: true, params: args.gdbschema});
		return db.none(pgpFile).catch(error => {
			console.log("Problem processing gdb template: ");console.log(error); 
			throw new Error(error);
		});
	} else {
		return Promise.reject("Unknown gdb schema type");
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
	
			





