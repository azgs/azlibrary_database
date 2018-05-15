#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

const args = require('commander');

args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the collection(s). Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. Required if source directory includes a geodatabase.')
	.option('-P, --private', 'Indicates if this is a private collection.')
	.option('-r, --repeat', 'Indicates that the source directory contains multiple collections source directories.') 
	.parse(process.argv);

/*
console.log("source = " + args.source);
console.log("dbname = " + args.dbname);
console.log("username = " + args.username);
console.log("password = " + args.password);
console.log("gdb schema = " + args.gdbschema);
console.log("private = " + args.private);
console.log("repeat = " + args.repeat);
*/

const datasetName = args.source.split("/").pop(); //The last element in the path

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;

let collectionID;
let uploadID;

// get password sorted
let promise = new Promise((resolve) => {
	if (!args.password) {
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

	const path = require("path");
	const dsPath = path.resolve(args.source);//path.join(process.cwd(), args[0]);
	const cn = 'postgres://' + args.username + ':' + args.password + '@localhost:5432/' + args.dbname;
	db = pgp(cn);
	const collectionsInsert = 
		"insert into public.collections (azgs_path, private) values ($$" + dsPath + "$$, " + (args.private ? true : false) + ") returning collection_id";
	//console.log(collectionsInsert);
	//TODO: Do we want to allow updates to a collection?
	return db.one(collectionsInsert).catch(error => {throw new Error(error);});
}).then(data => {
	collectionID = data.collection_id;
	console.log("collection id = " + collectionID);

	const uploadsInsert = 
		"insert into public.uploads (collection_id, created_at) values ($$" +
		collectionID + "$$, current_timestamp) returning upload_id";
	//console.log(uploadsInsert);
	return db.one(uploadsInsert).catch(error => {throw new Error(error);});
}).then(data => {
	uploadID = data.upload_id;

	const promises = [
		require("./gisdata").upload(args.source, datasetName, collectionID, db, args.dbname, args.username, args.password),
		require("./metadata").upload(args.source, "", "metadata", collectionID, db),
		require("./notes").upload(args.source, collectionID, db),
		require("./documents").upload(args.source, collectionID, db),
		require("./images").upload(args.source, collectionID, db)
	];
	//return Promise.all(promises).catch(error => {throw new Error(error);})
	promiseUtil = require("./promise_util");
	return Promise.all(promises.map(promiseUtil.reflect)).then(results => {
		if (results.filter(result => result.status === "rejected").length === 0) {
			return Promise.resolve();
		} else {
			return Promise.reject(results);
		}
	});
}).then(() => {
	return db.none("vacuum analyze").catch(error => {throw new Error(error);});
}).then(() => {

	return db.none("update public.uploads set completed_at = current_timestamp where upload_id=" + uploadID)
	.catch(error => {throw new Error(error);});
}).then(() => {
	console.log("successfully completed upload for collection_id " + collectionID);
	pgp.end();
})
.catch(error => {
	console.log("Error during upload of collection_id " + collectionID);
	console.log(error); 
	console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!rolling back!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
	const rollback = require("./rollback");
	rollback.rollback(collectionID, db).then(() => {
		console.log("rollback complete");
		pgp.end();
	}).catch(error => {console.log(error);});
}).then(() => {
	return require("./archiver").archive(args.source);
}).catch(error => {console.log("Unable to create archive of source directory."); console.log(error)});




