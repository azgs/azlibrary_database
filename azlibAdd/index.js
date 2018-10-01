#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

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
	logger.debug("typeof Object = " + typeof object);
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
		//logger.error("Repeat option not yet implemented");
		const fs = require('fs');
		if (!fs.existsSync(global.args.source)) {
			logger.warn(global.args.source + " directory found");
			//return Promise.resolve();
			throw new Error(global.args.source + " directory found");
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
		
		collections.reduce((promiseChain, collection) => {
			logger.silly("reduce iteration, collection = " + collection.path);
			return promiseChain.then(() => {
				logger.silly("promiseChain.then");
				return processCollection(collection);
			});
		}, Promise.resolve())
		.then(() => {
			logger.debug("----------------------all done-----------------------");
			/*pgp.end();*/
			logger.info(global.pp(collections));
			return Promise.resolve();
		});
			
	} else {
		const collection = { path:'', result:null, processingNotes:[]};
		return processCollection(collection);
	}
});/*
.catch(() => {
	pgp.end();
})
.then(() => {
	pgp.end();
});*/

//TODO:Hmmm... why did I put this here and not use it?
function processCollectionFactory(source) {
	return processCollection(source);
}

//const processCollection = (source) => {
function processCollection(collection)  {
	const source = path.join(global.args.source, collection.path);

	const rollback = require("./rollback");

	return new Promise((resolve, reject) => {
		logger.debug("processing collection " + source);

		global.datasetName = source.split("/").pop(); //The last element in the path

		let collectionID;
		let uploadID;

		//const path = require("path");
		let dsPath;
		if (global.args.archive) {
			dsPath = path.resolve(global.args.archive, collection.path);
		} else {
			dsPath = path.resolve(source);
		}
		logger.silly("dsPath = " + dsPath);

		const collectionsInsert = 
			"insert into public.collections (azgs_path, private) values ($$" + dsPath + "$$, " + (global.args.private ? true : false) + ")" + 
			" on conflict (azgs_path) do update set private = " + (global.args.private ? true : false) +			
			" returning collection_id, (xmax = 0) AS inserted";
		logger.silly("collectionsInsert = " + collectionsInsert);

		return db.one(collectionsInsert).catch(error => {logger.silly("error on insert collections");throw new Error(error);})
		.then(data => {
			logger.silly("collectionsInsert success");
			collectionID = data.collection_id;
			logger.debug("collection id = " + collectionID);
			logger.silly("inserted = " + data.inserted);

			//If insert was performed, resolve. Otherwise, an update was performed. 
			//In this case, call rollback to clear data in prepartion for reloading.
			return Promise.resolve().then(() => {
				if (data.inserted) {
					logger.silly("insert is true, resolving");
					return Promise.resolve();
				} else {
					logger.silly("insert is false, rolling back");
					return rollback.rollback(collectionID, db);
				}
			});
		}).then(() => {
			logger.silly("Preparing to insert upload record");
			const uploadsInsert = 
				"insert into public.uploads (collection_id, created_at) values ($$" +
				collectionID + "$$, current_timestamp) returning upload_id";
			//console.log(uploadsInsert);
			return db.one(uploadsInsert).catch(error => {throw new Error(error);});
		}).then(data => {
			return require("./metadata").upload(source, "", "metadata", collectionID, db)
			.then(() => {return Promise.resolve(data)}).catch((error) => {logger.error("Unable to process top-level metadata: " + error); return Promise.reject(error);});
		}).then(data => {
			uploadID = data.upload_id;

			const promises = [
				require("./gisdata").upload(source, global.datasetName, collectionID, db),
				//require("./metadata").upload(source, "", "metadata", collectionID, db),
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

			return db.none("update public.uploads set completed_at = current_timestamp where upload_id=" + uploadID)
			.catch(error => {throw new Error(error);});
		}).then(() => {
			logger.info("successfully completed upload for collection_id " + collectionID);
			global.datasetName = undefined; 
			//pgp.end();
			resolve();
		}).then(() => {
			collection.result = "success"; //TODO: this should reflect archiving as well
			if (global.args.archive) {
				logger.silly("squishin stuff");
				return require("./archiver").archive(source, global.args.archive).catch(error => {
					logger.error("Unable to create archive of source directory. " + global.pp(error));
					throw new Error(error);
				});
			} else {
				logger.silly("returning blank resolve");
				resolve();
			}
		}).catch(error => {
			collection.result = "failure";
			collection.processingNotes.push(error);
			logger.error("Error during upload of collection_id " + collectionID + ": " + global.pp(error)); 
			rollback.rollback(collectionID, db)
			.catch(error => {
				logger.error(error);
				collection.processingNotes.push("\nrollback failed. Manual rollback required");
			}).then(() => {
				//create error file?
				//move dir to failure dir
				return require("./failure").process(collection, source).catch((error) => {
					logger.error("Unable to move collection to failure directory: " + global.pp(error));
					return Promise.resolve(); //TODO: more serious action here?				
				});
			}).then(() => {
				global.datasetName = undefined; 
				//pgp.end();
				logger.silly("resolving");				
				resolve();
			});

		});
	
	});
}



