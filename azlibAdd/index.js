#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

const args = process.argv.slice(2);

if (args[0] === "--help") {
	console.log("Usage: azlibAdd source_directory gdb_schema_name db_name db_user [db_password]");
	return;
}

const datasetName = args[0].split("/").pop(); //The last element in the path

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;

let collectionID;
let uploadID;

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
/*
	args[4] = password;

	const cn = 'postgres://' + args[3] + ':' + args[4] + '@localhost:5432/' + args[2];
	db = pgp(cn);

	//TODO: This filename will need to be mandated by the dir structure definition
	//TODO: In fact, we'll probably want a format validation module here to go through the whole directory
	const metadata = require(process.cwd() + "/" + args[0] + "/metadata/" + datasetName + ".json");
		
	//First, create a new projects record for this project
	//TODO: public_id is no longer required by collections, so what to do with this insert?
	//TODO: Might need to check for existing record first
	const projectsInsert = 
		"insert into public.projects (project_name, project_desc) values ($$" +
		metadata.metadata.idinfo.citation.citeinfo.title + "$$, $$" +
		metadata.metadata.idinfo.descript.abstract + "$$) returning project_id";
	//console.log(projectsInsert);
	return db.one(projectsInsert).catch(error => {throw new Error(error);});
}).then(data => {
	console.log("project_id = " + data.project_id);
*/

	//Next, create a new record in the collections table
	/*
	const collectionsInsert = 
		"insert into public.collections (project_id, azgs_path) values (" +
		data.project_id + ", $$" +
		"<path info here>" + "$$) returning collection_id";
	*/
	const cn = 'postgres://' + args[3] + ':' + args[4] + '@localhost:5432/' + args[2];
	db = pgp(cn);
	const collectionsInsert = 
		"insert into public.collections (azgs_path) values ($$<path info here>$$) returning collection_id";
	//console.log(collectionsInsert);
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
		require("./geodata").upload(args[0], datasetName, collectionID, db, args[2], args[3], args[4]),
		require("./metadata").upload(args[0], "metadata", collectionID, db),
		require("./notes").upload(args[0], collectionID, db),
		require("./documents").upload(args[0], collectionID, db),
		require("./images").upload(args[0], collectionID, db)
	];
	return Promise.all(promises).catch(error => {throw new Error(error);})
}).then(() => {
	return db.none("vacuum analyze").catch(error => {throw new Error(error);});
}).then(() => {

	return db.none("update public.uploads set completed_at = current_timestamp where upload_id=" + uploadID)
	.catch(error => {throw new Error(error);});
}).then(() => {
	console.log("successfully completed upload");
	pgp.end();
})
.catch(error => {
	console.log(error); 
	pgp.end();
});




