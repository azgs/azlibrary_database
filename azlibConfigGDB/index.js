#!/usr/bin/env node


global.args = require('commander');

args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the gdb. Required')
	.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. If a recognized schema name (e.g. ncgmp09, gems), schema will be prepped accordingly. Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	.parse(process.argv);

const pgp = require("pg-promise")({
	// Initialization Options
});
let db;

const ogr2ogr = require('ogr2ogr');

const gdal = require("gdal");
const dataset = gdal.open(args.source);
const layers = dataset.layers.map((layer, i) => {
	return args.gdbschema + '."' + layer.name + '"';
});
//console.log(layers);
//console.log(layers.toString());


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
	//fill it with tables from a dummy gdb 
	//TODO: Move the ogr2ogr call to a module that wraps it in a promise
	const ogrPromise = new Promise((resolve, reject) => {
		ogr2ogr(args.source)
		.format('PostgreSQL')
		.options(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-gt', 'unlimited'])
		.destination('PG:host=localhost user=' + args.username + ' password=' + args.password + ' dbname=' + args.dbname + ' schemas=' + args.gdbschema)
		.exec((error, data) => {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
	return ogrPromise.catch(error => {throw new Error(error);});
}).then((data) => {
	return db.none('set search_path to ' + args.gdbschema).catch(error => {throw new Error(error);}); //TODO: not sure this is necessary
}).then(() => {
	//clear out the data (all we wanted was the tables)
	return db.none('truncate ' + layers.toString() + ' cascade').catch(error => {throw new Error(error);});
}).then(() => {
	console.log("Truncate successful");

	//add collection_id column to each table
	cidPromises = layers.map(layer => {
		//console.log(layer);
		return db.none('alter table ' + layer + ' add column collection_id integer references public.collections (collection_id)')
		.then(() => {
			console.log("successfully added collection_id to " + layer)
		})
		.catch(error => {throw new Error(error);});
	});  

	return Promise.all(cidPromises).catch(error => {throw new Error(error);});
}).then(() => {
	//TODO: Currently using the same template for ncgmp09 and gems. This is not accurate and will change in the future.
	if (args.gdbschema.toLowerCase() === "ncgmp09" || args.gdbschema.toLowerCase() === "gems") {
		//TODO: Kind of cheesy to have to do this to get path to this folder. Is there a better way?
		let pathToMe = require("global-modules-path").getPath("azlibConfigGDB");

		const file = pgp.QueryFile(pathToMe + '/ncgmp09.sql', {minify: true});

		return db.none(file).catch(error => {
			console.log("Problem processing ncgmp09 template: ");console.log(error); 
			throw new Error(error);
		});
	} else {
		return Promise.resolve();
	}
}).then(() => {
	console.log("collection_id successfully added to all tables");
	pgp.end();
})
.catch(error => { 
	console.log(error);
});
	
			





