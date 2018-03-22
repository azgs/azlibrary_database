#!/usr/bin/env node
const args = process.argv.slice(2);

if (args[0] === "--help") {
	console.log("Usage: azlibConfigPG db_name db_user [db_password]");
	return;
}

const path = require('path');

const pgp = require("pg-promise")({
	// Initialization Options
});

let db;

//console.log("Hi there");

// get password sorted
let pwPromise = new Promise((resolve) => {
	if (args.length === 2) {
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
		resolve(args[2]);
	}
});

pwPromise.then((password) => {
	args[2] = password;
	//console.log("args[2] = " + args[2]);

	//create database
	const tmpcn = 'postgres://' + args[1] + ':' + args[2] + '@localhost:5432/postgres';
	db = pgp(tmpcn);
	return db.none('create database ' + args[0]).catch(error => {throw new Error(error);});
}).then(() => { 
	console.log("db created");
	const cn = 'postgres://' + args[1] + ':' + args[2] + '@localhost:5432/' + args[0];
	db = pgp(cn);
		
	//set up PostGIS
	return db.none('create extension postgis').catch(error => {throw new Error(error);});
}).then(() => { 		
	//set up hstore
	return db.none('create extension hstore').catch(error => {throw new Error(error);});
}).then(() => {

	//TODO: Kind of cheesy to have to do this to get path to schemas folder. Is there a better way?
	let pathToMe = require("global-modules-path").getPath("azlibConfigPG");

	const schemas = pgp.utils.enumSql(pathToMe + '/schemas', {recursive: true}, file => {
		return new pgp.QueryFile(file, {minify: true});
	});

	const ddlPromise = Object.keys(schemas).reduce((promiseChain, schema) => {
		return promiseChain.then(() => new Promise((resolve, reject) => {
			//console.log("schema = " + schema);
			//console.log(schemas[schema]);
			db.none(schemas[schema])
			.then(() => {
				console.log(schema + " initialized");
				resolve();
			})
			.catch(error => {
				reject("Error processing schema " + schema + ": " + error);
			});
		}));
	}, Promise.resolve());

	return ddlPromise.catch(error => {throw new Error(error)});
}).then(() => {
		return db.none("vacuum analyze").catch(error => {throw new Error(error);});
}).then(() => {
	pgp.end();
})
.catch(error => { 
	console.log(error);
});
		


function sql(file) {
console.log(process.cwd);
    const fullPath = process.cwd + file; //path.join(__dirname, file);
    return new pgp.QueryFile(fullPath, {minify: true});
}








