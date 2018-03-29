#!/usr/bin/env node

const args = process.argv.slice(2);

if (args[0] === "--help") {
	console.log("Usage: azlibConfigGDB source_gdb_directory schema_name db_name db_user [db_password]");
	return;
}

const pgp = require("pg-promise")({
	// Initialization Options
});
let db;

const ogr2ogr = require('ogr2ogr');

const gdal = require("gdal");
const dataset = gdal.open(args[0]);
const layers = dataset.layers.map((layer, i) => {
	return args[1] + '."' + layer.name + '"';
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
		resolve(args[4]);
	}
});


promise.then((password) => {
	args[4] = password;
	//console.log("args[4] = " + args[4]);

	const cn = 'postgres://' + args[3] + ':' + args[4] + '@localhost:5432/' + args[2];
	db = pgp(cn);

	//create schema
	return db.none('create schema ' + args[1]).catch(error => {throw new Error(error);});
}).then(() => { 
	//fill it with tables from a dummy gdb 
	//TODO: Move the ogr2ogr call to a module that wraps it in a promise
	const ogrPromise = new Promise((resolve, reject) => {
		ogr2ogr(args[0])
		.format('PostgreSQL')
		.options(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-gt', 'unlimited'])
		.destination('PG:host=localhost user=' + args[3] + ' password=' + args[4] + ' dbname=' + args[2] + ' schemas=' + args[1])
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
	return db.none('set search_path to ' + args[1]).catch(error => {throw new Error(error);}); //TODO: not sure this is necessary
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
	console.log("collection_id successfully added to all tables");
	pgp.end();
})
.catch(error => { 
	console.log(error);
});
	
			





