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

let existingTables;
//Create list of layers in new gdb
const gdal = require("gdal");
console.log(process.cwd() + "/" + args[0] + "/" + datasetName +".gdb");
//const dataset = gdal.open(process.cwd() + "/" + args[0] + "/" + args[0] + ".gdb");
const dataset = gdal.open(process.cwd() + "/" + args[0] + "/" + datasetName +".gdb");
const layers = dataset.layers.map((layer, i) => {
	return args[1] + '."' + layer.name + '"';
});

let collectionID;
let uploadID;

const ogr2ogr = require('ogr2ogr');

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

	const cn = 'postgres://' + args[3] + ':' + args[4] + '@localhost:5432/' + args[2];
	db = pgp(cn);

	//TODO: This filename will need to be mandated by the dir structure definition
	//TODO: In fact, we'll probably want a format validation module here to go through the whole directory
	const metadata = require(process.cwd() + "/" + args[0] + "/" + datasetName + ".json");
		
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

	//Next, create a new record in the collections table
	const collectionsInsert = 
		"insert into public.collections (project_id, azgs_path) values (" +
		data.project_id + ", $$" +
		"<path info here>" + "$$) returning collection_id";
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

	//Create list of existing tables for comparison to new gdb content
	return db.any("select table_name from information_schema.tables where table_schema='" +  args[1] + "'")
	.catch(error => {throw new Error(error);});
}).then(tables => {
	existingTables = tables.map((table, i) => {
		return args[1] + '."' + table.table_name + '"';
	});
	//console.log("existing tables"); console.log(existingTables);

	//append new gdb to existing gdb
	const ogrPromise = new Promise((resolve, reject) => {
		ogr2ogr(args[0] + "/" + datasetName + ".gdb")
		.format('PostgreSQL')
		.options(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-append'])
		.destination('PG:host=localhost user=' + args[3] + ' password=' + args[4] + ' dbname=' + args[2] + ' schemas=' + args[1])
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
	const jsonPath = process.cwd() + "/" + args[0] + "/" +  datasetName + ".json";
	let jsonMetadata	
	try {
		jsonMetadata = require(jsonPath);
	} catch (err) {
		console.log("JSON metadata file not found");
		return Promise.resolve();
	}

	const metadataInsert = 
		"insert into metadata.json_entries (collection_id, metadata, metadata_file) values (" +
		collectionID + ", $$" +
		JSON.stringify(jsonMetadata) + "$$, $$" +
		jsonPath + "$$)";
	//console.log(metadataInsert);
	return db.none(metadataInsert).catch(error => {throw new Error(error);});
}).then(() => {
	//read xml file
	const xmlPath = process.cwd() + "/" + args[0] + "/" + datasetName + ".xml";
	let xmlMetadata
	let fs = require('fs');

	filePromise = new Promise((resolve, reject) => {
		fs.readFile(xmlPath, 'utf-8', function (error, data){
			if(error) {
				console.log(error);
				resolve(null);
			}
			resolve(data);    
		}); 
	});
	return filePromise.catch(error => {throw new Error(error);});
}).then((data) => {      
	if (data === null) {
		console.log("no xml data");
		return Promise.resolve();
	}
	//console.log("xml data = " + data);
	const xmlPath = process.cwd() + "/" + args[0] + "/" + datasetName + ".xml";
	const metadataInsert = 
		"insert into metadata.xml_entries (collection_id, textdata, xmldata, metadata_file) values (" +
		collectionID + ", $$" + 
		data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
		data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
		xmlPath + "$$)";
	console.log(metadataInsert);
	return db.none(metadataInsert).catch(error => {throw new Error(error);});
//}).then(() => {
//	db.one("select XMLSERIALIZE ( DOCUMENT metadata AS text ) from metadata.xml_entries where collection_id = 1").then(data => {console.log(data); return Promise.resolve()});
}).then(() => {
	return db.none("vacuum analyze").catch(error => {throw new Error(error);});
}).then(() => {
	//find any new tables brought in with this gdb
	const newTables = layers.reduce((acc, layer) => {
		if (!existingTables.includes(layer)) {
			acc.push(layer);
		}
		return acc;
	}, []);
	console.log("new tables"); console.log(newTables);

	//add collection_id column to each new table
	const newTablePromises = newTables.map(table => {
		//console.log(table);
		return db.none('alter table ' + table + ' add column collection_id integer references public.collections (collection_id)')
		.then(() => {
			console.log("successfully added collection_id to " + table)
		})
		.catch(error => {throw new Error(error);});
	});               
	return Promise.all(newTablePromises).catch(error => {throw new Error(error);});
}).then (() => {
	//Set collection_id in each record that has a null
	//TODO: This approach is a little janky
	const cidPromises = layers.map((layer, i) => {
		//console.log("layer = " + layer);
		return db.none("update " + layer + 
			" set collection_id = " + collectionID +
			" where collection_id is null")
		.then(() => {
			console.log("successfully updated collection_id for " + layer);
		})
		.catch(error => {throw new Error(error);});
	});
	return Promise.all(cidPromises).catch(error => {throw new Error(error);});
}).then(() => {
	console.log(args[0] + ".gdb successfully added");
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




