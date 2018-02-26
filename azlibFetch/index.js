#!/usr/bin/env node

const args = process.argv.slice(2);

//TODO: GeoJSON requires a single layer be specified
if (args[0] === "--help") {
	console.log("Usage: azlibFetch collection_id output_name output_format gdb_schema_name db_name db_user [db_password]");
	return;
}

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;

const ogr2ogr = require('ogr2ogr');

// get password sorted
let promise = new Promise((resolve) => {
	if (args.length === 6) {
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
		resolve(args[6]);
	}
});


promise.then((password) => {
	args[6] = password;
	//verify collection_id
	const cn = 'postgres://' + args[5] + ':' + args[6] + '@localhost:5432/' + args[4];
	db = pgp(cn);
	return db.one("select * from public.collections where collection_id=" + args[0])
	.catch(error => {throw new Error(error);});
}).then(() => {
	const ogrPromise = new Promise((resolve, reject) => {
		ogr2ogr('PG:host=localhost user=' + args[5] + ' password=' + args[6] + ' dbname=' + args[4] + ' schemas=' + args[3])
		.format(args[2])
		.options(['-where', 'collection_id=' + args[0]])
		.destination(args[1])
		.exec(function(error, data) {
			if (error) {
				reject(error);
			} else {
				resolve(data);
			}
		});
	});
	return ogrPromise.catch(error => {throw new Error(error);});
}).then(data => {
	pgp.end();
}).catch(error => {
	pgp.end();
	console.log(error);
});































