#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

//TODO: There a chunk of code in here for testing metadata queries that should go away at some 
//point. In the meantime, its execution is controlled by testMetadataQueries
const testMetadataQueries = false;

const path = require("path");

global.args = require('commander');

global.args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the collection(s). Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	//.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. Required if source directory includes a geodatabase.')
	.option('-P, --private', 'Indicates if this is a private collection.')
	.option('-a, --archive [archive_directory]', 'Indicates whether to archive the source directory into a tar.gz. If archive is present but archive_directory is not, defaults to source directory.')
	.option('-f, --failure_directory <failure_directory>', 'Directory to move failed uploads to. Default is to leave in source directory.')
	.option('-U, --unrecOK', 'Indicates whether to allow unrecognized files in gdb schemas.')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
	.option('-r, --repeat', 'Indicates that the source directory contains multiple collections source directories.') 
	.parse(process.argv);
if (global.args.archive === true) global.args.archive = path.dirname(global.args.source);

/*
console.log("source = " + args.source);
console.log("dbname = " + args.dbname);
console.log("username = " + args.username);
console.log("password = " + args.password);
console.log("gdb schema = " + args.gdbschema);
console.log("private = " + args.private);
console.log("repeat = " + args.repeat);
*/

global.pp = (object) => {
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};

const logger = require("./logger")(path.basename(__filename));

logger.debug(global.pp(global.args));
logger.debug(global.pp("source = " + global.args.source));
logger.debug(global.pp("archive = " + global.args.archive));
logger.debug(global.pp("archive_directory = " + global.args.archive_directory));
logger.debug(global.pp("failure_directory = " + global.args.failure_directory));


// get password sorted
let pwPromise = new Promise((resolve) => {
	if (!global.args.password) {
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
		resolve(global.args.password);
	}
});

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;



pwPromise.then((password) => {

	global.args.password = password;

	const cn = 'postgres://' + global.args.username + ':' + global.args.password + '@localhost:5432/' + global.args.dbname;
	db = pgp(cn);

	return require("./config").load(db)
}).then(() => {
	if (global.args.repeat) {
		const fs = require('fs-extra');
		if (!fs.existsSync(global.args.source)) {
			logger.warn(global.args.source + " directory not found");
			return Promise.reject(global.args.source + " directory not found");
		}

		let collectionPaths = [];
		try {
			collectionPaths = fs.readdirSync(global.args.source).filter(f => fs.statSync(path.join(global.args.source, f)).isDirectory());
		} catch(err) {
			return Promise.reject("Problem accessing collections directories: " + err);
		}
		logger.silly("collectionPaths = " + global.pp(collectionPaths));

		const collections = collectionPaths.map((cP) => {
			return {path: cP, result: null, processingNotes: []};
		});
		
		return collections.reduce((promiseChain, collection) => {
			logger.silly("reduce iteration, collection = " + collection.path);
			return promiseChain.then(() => {
				logger.silly("promiseChain.then");
				return processCollection(collection)
			}).catch(error => {
				//When processing multiple collections, we always return success to the command line. 
				//Errors are in the collections array we just printed to the log, and in each collection folder.
				logger.warn("Error processing collection: " + global.pp(error));
				return Promise.resolve();
			});
		}, Promise.resolve())
		.then(() => {
			logger.debug("----------------------all done-----------------------");
			logger.info(global.pp(collections));
			return Promise.resolve(); 
		});
			
	} else {
		const collection = { path:'', result:null, processingNotes:[]};
		return processCollection(collection).catch(error => {
			//When processing a single collection, we want to return any failure to the command line.
			logger.error("returning failure");
			process.exit(1);
		});
	}
})
.catch(() => {
	pgp.end();
})
.then(() => {
	pgp.end();
});


		


//const processCollection = (source) => {
function processCollection(collection)  {
	const source = path.join(global.args.source, collection.path);
	logger.silly("source = " + source);

	const rollback = require("./rollback");
	const fs = require("fs-extra");
	const azgs = require("./azgsMetadata");

	let metadata;

	//We don't keep this in metadata because they should not leak to the outside in azgs.json
	let collectionID;
	let collectionGroupID;
	let uploadID;

	//first, read the metadata from azgs.json
	return azgs.readMetadata(source).then((md) => {
		logger.debug("processing collection " + source);
		metadata = md;
		logger.silly("metadata = " + global.pp(metadata));

		//datasetName is used by the logger
		global.datasetName = source.split("/").pop(); //The last element in the path

	}).then(() => {
		return db.one("select collection_group_id from collection_groups where collection_group_name = $1", [metadata.collection_group.name]);
	}).then((result) => {
		collectionGroupID = result.collection_group_id;

		let azgs_old_url = metadata.links.filter(link => 
			(link.name && link.name.toLowerCase() === "azgs old")).shift();
		azgs_old_url = azgs_old_url ? azgs_old_url.url : null;
		let ua_library = metadata.links.filter(link => 
			(link.name && link.name.toLowerCase() === "ua library")).shift();
		ua_library = ua_library ? ua_library.url : null;

		//This is a snazzy thing used by pg-promise to trigger use of a default value on insert
		const DEFAULT = {
			rawType: true,
			toPostgres: () => 'default'
		};

		//Upsert collection record
		const insertSQL = `insert into public.collections (
								azgs_path, 
								private, 		
								formal_name, 
								informal_name, 
								azgs_old_url, 
								ua_library, 
								collection_group_id, 
								perm_id)
							values ($1, $2, $3, $4, $5, $6, $7, $8)
							on conflict (perm_id) do update set
								azgs_path = $1,
								private = $2,
								formal_name = $3,
								informal_name = $4,
								azgs_old_url = $5,
								ua_library = $6,
								collection_group_id = $7
							returning collection_id, perm_id, (xmax=0) as inserted`;
		const upsertParams = [
			path.resolve(source),
			(global.args.private ? true : false),
			metadata.title,
			metadata.informal_name,
			azgs_old_url,
			ua_library,
			collectionGroupID,
			metadata.identifiers.perm_id ? metadata.identifiers.perm_id : DEFAULT
		];
							
		return db.one(insertSQL, upsertParams).then((result) => {
			collectionID = result.collection_id; 
			metadata.identifiers.perm_id = result.perm_id;

			return Promise.resolve().then(() => {
				//Update azgs_path if archive was specified
				if (global.args.archive) {
					metadata.identifiers.directory = path.resolve(global.args.archive, ""+metadata.identifiers.perm_id);
					const updateSQL = "update public.collections set azgs_path = $1 where collection_id = $2";
					const updateParams = [
						path.join(global.args.archive, "" + metadata.identifiers.perm_id),
						collectionID
					];
					return db.none(updateSQL, updateParams);
				} else {
					metadata.identifiers.directory = path.resolve(global.args.source);
					return Promise.resolve();
				}
			}).then(() => {
				//If this is an update, rollback the old collection data
				if (result.inserted) {
					logger.debug("Inserted");
					return Promise.resolve();
				} else {
					logger.debug("Updated");
					return rollback.rollback(collectionID, db);
				}
			});
		});

	}).then(() => {
		logger.silly("Preparing to insert upload record");
		const uploadsInsert = 
			"insert into public.uploads (collection_id, created_at) values ($1, current_timestamp) returning upload_id";
		const uploadsParams = [
			collectionID
		];
		return db.one(uploadsInsert, uploadsParams).catch(error => {throw new Error(error);});
	}).then((upload) => {
		uploadID = upload.upload_id;
		return azgs.upload(metadata, collectionID, db).catch((error) => { //TODO: Do we need this catch?
			logger.error("Unable to process azgs metadata: " + error); 
			return Promise.reject(error);
		});
	}).then(() => {
		const promises = [
			require("./gisdata").upload(source, collectionID, db),
			require("./metadata").upload(source, "", "metadata", collectionID, db),
			require("./notes").upload(source, collectionID, db),
			require("./documents").upload(source, collectionID, db),
			require("./images").upload(source, collectionID, db)
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
		//Update uploads record with finish
		return db.none("update public.uploads set completed_at = current_timestamp where upload_id=" + uploadID)
		.catch(error => {throw new Error(error);});
	}).then(() => {
		//Write metadata to azgs.json 
		return fs.writeJson(path.join(source, "azgs.json"), metadata, {spaces:"\t"});
	}).then(() => {
		//Create archive tarball if archive specified
		if (global.args.archive) {
			logger.silly("squishin stuff");
			const dest = path.join(global.args.archive, "tmp", "" + metadata.identifiers.perm_id);
			return fs.move(source, dest).then(() => {
				return require("./archiver").archive(dest, global.args.archive, metadata.identifiers.perm_id).catch(error => {
					logger.error("Unable to create archive of source directory. " + global.pp(error));
					throw new Error(error);
				});
			});
		} else {
			logger.silly("returning blank resolve");
			return Promise.resolve();
		}
	}).then(() => {
		logger.info("successfully completed upload for collection_id " + collectionID + " (perm_id = " + metadata.identifiers.perm_id + ")");
		collection.result = "success"; 
		global.datasetName = undefined; 
		return Promise.resolve();
	}).catch(error => {
		collection.result = "failure";
		const serialError = require('serialize-error');
		collection.processingNotes.push(serializeError(error));
		return Promise.resolve(error).then((error) => {
			//First, handle rollback if necessary
			if (metadata) { //If not, failure is from reading that. Do nothing.
				logger.error("Error during upload of collection_id " + collectionID + ": " + global.pp(error)); 
				return rollback.rollback(collectionID, db)
				.catch(error2 => {
					logger.warn("Unable to role back: " + global.pp(error));
					collection.processingNotes.push("\nrollback failed. Manual rollback required: " + global.pp(error2));
					return Promise.resolve(error);
				})
			} else {
				return Promise.resolve(error);
			}
		}).then((error) => {
			//Write metadata to azgs.json 
			return fs.writeJson(path.join(source, "azgs.json"), metadata, {spaces:"\t"})
			.then((error) => {return Promise.resolve(error)});
		}).then((error) => {
			//Then, handle failure reporting
			return require("./failure").process(collection, source).catch((error2) => {
				logger.error("Unable to create failure record and move collection to failure directory: " + global.pp(error2));
				return Promise.resolve(); //return resolve so we can clean up global before rejecting to calling routine				
			});
		}).then(() => {
			//Finally, clean up global and reject to calling routine
			global.datasetName = undefined; 
			logger.silly("wrapping up collection error");				
			return Promise.reject(error);
		});

	});
}



