#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

//TODO: There a chunk of code in here for testing metadata queries that should go away at some 
//point. In the meantime, its execution is controlled by testMetadataQueries
const testMetadataQueries = false;

const path = require("path");
const fs = require("fs-extra");

global.args = require('commander');

global.args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the collection(s). Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	.option('-h, --host <host>', 'Postgres host')
	.option('-o, --port <port>', 'Postgres port')
	.option('-c, --cert <cert>', 'SSL public cert for PG')
	//.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. Required if source directory includes a geodatabase.')
	.option('-P, --private', 'Indicates if this is a private collection.')
	.option('-f, --failure_directory <failure_directory>', 'Directory to move failed uploads to. Default is to leave in source directory.')
	.option('-U, --unrecOK', 'Indicates whether to allow unrecognized files in gdb schemas.')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
	.option('-r, --repeat', 'Indicates that the source directory contains multiple collections source directories.') 
	.option('-a, --apioptions <apioptions>', 'JSON containing options (used internally from api server).') 
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

global.pp = (object) => {
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};

const logger = require("./logger")(path.basename(__filename));

global.apiOptions = {};
if (global.args.apioptions) {
 	global.apiOptions = JSON.parse(global.args.apioptions);
}

//logger.debug(global.pp(global.args));
logger.debug(global.pp("global source = " + global.args.source));
logger.debug(global.pp("failure_directory = " + global.args.failure_directory));

//The legal relative paths allowed for files in the collection
const legalPaths = [
	"metadata",
	"documents",
	path.join("documents", "metadata"),
	"images",
	path.join("images", "metadata"),
	"notes",
	path.join("notes", "metadata"),
	path.join("notes", "misc"),
	path.join("notes", "misc", "metadata"),
	path.join("notes", "standard"),
	path.join("notes", "standard", "metadata"),
	"gisdata",
	path.join("gisdata", "metadata"),
	path.join("gisdata", "layers"),
	path.join("gisdata", "layers", "metadata"),
	path.join("gisdata", "legacy"),
	path.join("gisdata", "legacy", "metadata"),
	path.join("gisdata", "ncgmp09"),
	path.join("gisdata", "ncgmp09", "metadata"),
	path.join("gisdata", "gems2"),
	path.join("gisdata", "gems2", "metadata"),
	path.join("gisdata", "raster"),
	path.join("gisdata", "raster", "metadata")
]


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

//const monitor = require('pg-monitor');

//This routine is to facilitate db debugging. It is not necessary.
const initOptions = {
    error: function (error, e) {
        if (e.cn) {
            // A connection-related error;
            //logger.debug("CN:", e.cn);
            logger.debug("EVENT:", error.message);
        }
    }
};
const pgp = require("pg-promise")(initOptions);
//monitor.attach(initOptions);
let db;

pwPromise.then((password) => {
	global.args.password = password;

	let cn = {
		user: global.args.username,
		password: global.args.password,
		host: global.args.host,
		database: global.args.dbname,
		port: global.args.port,
	};

	if (global.args.cert) {
		cn.ssl = {
			rejectUnauthorized: true,
			ca: fs.readFileSync(global.args.cert).toString(),
		};
	}
        //logger.silly(pp(cn));

        db = pgp(cn);
	
	return require("./config").load(db)
}).then(() => {
	if (global.args.repeat) {
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
}).catch((err) => {
	logger.error(err);
	pgp.end();
	process.exitCode = 1;
}).then(() => {
	pgp.end();
});


		


//const processCollection = (source) => {
function processCollection(collection)  {
	logger.debug("processCollection enter");
	const source = path.join(global.args.source, collection.path);
	logger.silly("source = " + source);

	//datasetName is used by the logger
	global.datasetName = source.split("/").pop(); //The last element in the path

	const clean = require("./clean");
	const fs = require("fs-extra");
	const azgs = require("./azgsMetadata");

	let metadata;

	const userQ = 
		"select user_id from users where email=$1";
	const userParams = [
		global.apiOptions.user
	];
	return db.oneOrNone(userQ, userParams).catch(error => {throw new Error(error);})
	.then((user) => {
		if (user === null) {
			logger.warn("User not found. Proceeding anyway."); 
		}

		//first, create upload record
		logger.silly("Preparing to insert upload record");
		//TODO: add user and action to uploads table and set here. Also in metadata patch code of api.
		const uploadsInsert = 
			"insert into public.uploads (created_at, source, user_id, action) values (current_timestamp, $1, $2, $3) returning upload_id";
		const uploadsParams = [
			source,
			user ? user.user_id : null,
			global.apiOptions.action
		];
		return db.one(uploadsInsert, uploadsParams).catch(error => {throw new Error(error);});
	}).then((upload) => {
		logger.silly("uploads insert successful, upload_id = " + upload.upload_id);
		collection.uploadID = upload.upload_id;

		//then read the metadata from azgs.json
		return azgs.readMetadata(source);
	}).then((md) => {
		metadata = md;
		logger.debug("metadata = " + global.pp(metadata));

		//get collection_group_id using group specifed in metadata
		return db.one("select collection_group_id from collection_groups where collection_group_name = $1", [metadata.collection_group.name]);
	}).then((result) => {
		collection.collectionGroupID = result.collection_group_id;

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
								private, 		
								formal_name, 
								informal_name, 
								azgs_old_url, 
								ua_library, 
								collection_group_id, 
								perm_id,
								supersedes)
							values ($1, $2, $3, $4, $5, $6, $7, $8)
							on conflict (perm_id) do update set
								private = $1,
								formal_name = $2,
								informal_name = $3,
								azgs_old_url = $4,
								ua_library = $5,
								collection_group_id = $6
							returning collection_id, perm_id, (xmax=0) as inserted`;
		const upsertParams = [
			(global.args.private || metadata.private ? true : false),
			metadata.title,
			metadata.informal_name,
			azgs_old_url,
			ua_library,
			collection.collectionGroupID,
			metadata.identifiers.perm_id ? metadata.identifiers.perm_id : DEFAULT,
			metadata.identifiers.supersedes
		];

		//Everything happens in a transaction. This way failures will be rolled back automatically.
		return db.tx((t) => {

			return t.one(insertSQL, upsertParams).then((result) => {
				logger.silly("Upserting...");
				collection.collectionID = result.collection_id; 
				collection.permID = result.perm_id; 
				collection.isNew = result.inserted;
				metadata.identifiers.perm_id = result.perm_id;
				logger.silly("result.inserted = " + global.pp(result.inserted));
				logger.silly("collection = " + global.pp(collection));	

				//If this is an update, rollback the old collection data
				if (result.inserted) {
					logger.debug("Inserted");
					return Promise.resolve();
				} else {
					logger.debug("Updated");
					return clean.prep(collection.collectionID, t);
				}
			}).then(() => { //update files in metadata
				const readDir = require("recursive-readdir");

				const pathRegex = new RegExp("^(" + legalPaths.join("|") + ")$", 'i');

				logger.silly("source = " + global.pp(source));
				return readDir(source, [
					(file, stats) =>
						//ignore non-standard directories (this also handles the case of unzipped gdb's)
						(stats.isDirectory() && !pathRegex.test(path.relative(source, file))) ||
						//ignore files in top level directory
						(!stats.isDirectory() && path.relative(source, file) === path.basename(file)) ||
						//ignore hidden files
						(/^\./.test(path.basename(file)))
				]).then(filePaths => {
					logger.silly("filePaths = " + global.pp(filePaths));
					const azgs = require("./azgsMetadata");
					const fileEntries = filePaths.reduce((accF, f) => {
						logger.silly("dirname = " + path.dirname(f));
						logger.silly("relative = " + path.relative(source, f));
						logger.silly("path within collection = " + path.dirname(path.relative(source, f)));
						const fileMeta = new azgs.File();

						fileMeta.name = path.basename(f);
						fileMeta.type = path.dirname(path.relative(source, f)).replace(new RegExp(path.sep,"g"), ":");
						logger.silly("fileMeta = " + global.pp(fileMeta));

						return accF.concat(fileMeta);
					}, []);

					metadata.files = fileEntries;
					return Promise.resolve();
				});
			}).then(() => { //add azgs metadata to db
				return azgs.upload(metadata, collection.collectionID, t).catch((error) => { //TODO: Do we need this catch?
					logger.error("Unable to process azgs metadata: " + error); 
					return Promise.reject(error);
				});
			}).then(() => {
				const promises = [
					require("./gisdata").upload(source, collection, t),
					require("./metadata").upload(source, "", "metadata", collection.collectionID, t),
					require("./notes").upload(source, collection.collectionID, t),
					require("./documents").upload(source, collection.collectionID, t),
					require("./images").upload(source, collection.collectionID, t)
				];
				//return Promise.all(promises).catch(error => {throw new Error(error);})
				promiseUtil = require("./promise_util");
				return Promise.all(promises.map(promiseUtil.reflect)).then(results => {
					if (results.filter(result => result.status === "rejected").length === 0) {
						return Promise.resolve();
						//return Promise.reject(new Error("Hogan's goat!"));//for testing!!!!!!!!!!!!!!
					} else {
						return Promise.reject(results);
					}
				});
			}).then(() => {
				logger.silly("squishin stuff");
				return require("./archiver").archive(source, metadata.identifiers.perm_id, t)
				.catch(error => {
					logger.error("Unable to create archive of source directory. " + global.pp(error));
					throw new Error(error);
				});
			}).then((oid) => {
				logger.silly("oid = " + oid);
				//Set archive_id and turn collection on
				return t.none(
					"update public.collections set archive_id = $1, removed = false where collection_id = $2",
					[oid, collection.collectionID]
				).catch(error => {throw new Error(error);});
			}).then(() => {
				//Deprecate old collection if necessary
				if (metadata.identifiers.supersedes) {
					return t.one(
						"select collection_id from public.collections where perm_id = $1", 
						[metadata.identifiers.supersedes]).then((result) => {
						//TODO: Using template variable for param to jsonb_set because I kept getting
						//a syntax error from postgres when I tried to use pg-promise index variable.
						//Maybe figure out why?
						return t.none(
							`update 
								metadata.azgs
							set
								json_data = jsonb_set(json_data, '{identifiers, superseded_by}', '"${collection.permID}"')
							where
								collection_id = $1`,
							[result.collection_id]);
					}).catch(error => {throw new Error(error);});
				} else {
					return Promise.resolve();
				}
			});
		});
	}).then(() => {
		//Update uploads record with finish
		const updateSQL = `
			update 
				public.uploads 
			set 
				collection_id = $1, 
				completed_at = current_timestamp,
				processing_notes = $2
			where 
				upload_id=$3
		`
		const updateValues = [
			collection.collectionID,
			JSON.stringify(collection.processingNotes),
			collection.uploadID
		]
		return db.none(updateSQL, updateValues)
		.catch(error => {throw new Error(error);});
	//}).then(() => {
	//	return db.none("vacuum analyze").catch(error => {throw new Error(error);});
	}).then(() => {
		return fs.remove(source);
		//return Promise.resolve(); //leave dir for testing
	}).then(() => {
		logger.info("successfully completed upload for collection_id " + collection.collectionID + " (perm_id = " + metadata.identifiers.perm_id + ")");
		collection.result = "success"; 
		global.datasetName = undefined; 
		return Promise.resolve();
	}).catch(error => {
		logger.info("Collection processing error. UploadID = " + collection.uploadID);
		logger.error(pp(error));
		collection.result = "failure";
		const serializeError = require('serialize-error');
		collection.processingNotes.push(serializeError(error));

		return Promise.resolve().then(() => {
			logger.silly("Error: In drop section");
			//If this collection had a gdb, there may be a remnant schema for it in the db at 
			//this point. This is because the temporary schema is created by ogr2ogr, which is
			//outside of the ongoing db transaction. After the gdb is imported, the temp schema
			//is deleted by the transaction. This means that when something goes wrong, 
			//the transaction rollback recreates the temporary schema, which we really don't 
			//want to leave laying around, so...
			if (collection.permID) {
				const tmpSchema = collection.permID.replace(/-/g, '_');
				db.none(`drop schema if exists ${tmpSchema} cascade`)
				.catch((err) => {
					logger.warn("Error dropping temp schema: " + global.pp(error));
					return Promise.resolve();
				}).then(() => {
					return Promise.resolve();
				});
			} else {
				return Promise.resolve();
			}
		}).then(() => {
			logger.silly("Error: In update uploads section");
			const update = collection.isNew ? 
				"update public.uploads set failed_at = current_timestamp, processing_notes = $2 where upload_id = $1" :
				"update public.uploads set collection_id = $3, failed_at = current_timestamp, processing_notes = $2 where upload_id = $1";
			const updateParams = [
				collection.uploadID,
				JSON.stringify(collection.processingNotes),
				collection.collectionID
				];
			return db.none(update, updateParams).catch(error => {logger.error("Problem updating failure in uploads: " + global.pp(error));});
		}).then(() => {
			//Then, handle failure reporting
			logger.silly("Error: In failure handler section");
			if (collection.isNew) {
				//Data has been rolled back, so collections record does not exist
				collection.permID = null;
				collection.collectionID = null;
			}
			return require("./failure").process(collection, source).catch((error) => {
				logger.error("Unable to create failure file and move collection to failure directory: " + global.pp(error));
				return Promise.resolve(); //return resolve so we can clean up global before rejecting to calling routine				
			});
		}).then(() => {
			//Finally, clean up global and reject to calling routine
			logger.silly("Error: In final section");
			global.datasetName = undefined; 
			logger.silly("wrapping up collection error");				
			return Promise.reject(error);
		});

	});
}


