#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

global.args = require('commander');

global.args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the collection(s). Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	//.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. Required if source directory includes a geodatabase.')
	.option('-P, --private', 'Indicates if this is a private collection.')
	.option('-a, --archive', 'Indicates whether to archive the source directory into a tar.gz.')
	.option('-U, --unrecOK', 'Indicates whether to allow unrecognized files in gdb schemas.')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
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

global.pp = (object) => {
	logger.debug("typeof Object = " + typeof object);
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};

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

const path = require("path");
const logger = require("./logger")(path.basename(__filename));

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
			return {path: cP, result: null, processingNotes: null};
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
		const collection = { path:'', result:null, processingNotes:null};
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

	return new Promise((resolve, reject) => {
		logger.debug("processing collection " + source);

		global.datasetName = source.split("/").pop(); //The last element in the path

		let collectionID;
		let uploadID;

		//const path = require("path");
		let dsPath = path.resolve(source);//path.join(process.cwd(), args[0]);;
		logger.silly("after dsPath");

		const collectionsInsert = 
			"insert into public.collections (azgs_path, private) values ($$" + dsPath + "$$, " + (global.args.private ? true : false) + ") returning collection_id";
		//console.log(collectionsInsert);
		//TODO: Do we want to allow updates to a collection?
		logger.silly("before collectionsInsert");
		return db.one(collectionsInsert).catch(error => {logger.silly("error on insert collections");throw new Error(error);})
		.then(data => {
			logger.silly("collectionsInsert success");
			collectionID = data.collection_id;
			logger.debug("collection id = " + collectionID);

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
				return require("./archiver").archive(source).catch(error => {
					logger.error("Unable to create archive of source directory. " + global.pp(error));
					throw new Error(error);
				});
			} else {
				logger.silly("returning blank resolve");
				resolve();
			}
		}).catch(error => {
			collection.result = "failure";
			collection.processingNotes = global.pp(error);
			logger.error("Error during upload of collection_id " + collectionID + ": " + global.pp(error)); 
			logger.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!rolling back!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
			const rollback = require("./rollback");
			rollback.rollback(collectionID, db).then(() => {
				logger.info("rollback complete");
				global.datasetName = undefined; 
				//pgp.end();
				logger.silly("resolving");				
				resolve();
			}).catch(error => {
				logger.error(error);
				collection.processingNotes += "\nrollback failed. Manual rollback required";
			});
		});
	
	});
}



