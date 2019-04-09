#!/usr/bin/env node

const path = require("path");
const fs = require('fs-extra');

global.args = require('commander');

global.args
	.version('0.0.1')
	.option('-s, --source <source>', 'Source directory of the collection(s). Required')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
	.option('-r, --repeat', 'Indicates that the source directory contains multiple collections source directories.') 
	.option('-o, --old_dbname <dbname>', 'Old DB name. Optional. This is only used if there are existing entries for UA_library and informal_name to be brought forward from a previous run. This was for a special use case and will likely be deprecated soon.')
	.option('-n, --new_dbname <dbname>', 'New DB name. Optional. Used to fetch collection group name based on azgs_old_url. This was for a special use case and will likely be deprecated soon.')
	.option('-u, --username <username>', 'DB username. Required if -o or -n specified.')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	.parse(process.argv);

global.pp = (object) => {
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};

const logger = require("./logger")(path.basename(__filename));

logger.debug(global.pp(global.args));
logger.debug(global.pp("source = " + global.args.source));

const pgp = require("pg-promise")({
	 //Initialization Options
});
const ocn = 'postgres://' + global.args.username + ':' + global.args.password + '@localhost:5432/' + global.args.old_dbname;
const ncn = 'postgres://' + global.args.username + ':' + global.args.password + '@localhost:5432/' + global.args.new_dbname;
global.odb = global.args.old_dbname ? pgp(ocn) : null;
global.ndb = global.args.new_dbname ? pgp(ncn) : null;
//logger.silly("global.args.dbname = " + global.args.dbname);
//logger.silly("global.db = " + global.pp(global.db));

return Promise.resolve().then(() => {
	if (global.args.repeat) {
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
		
		return collections.reduce((promiseChain, collection) => {
			logger.silly("reduce iteration, collection = " + collection.path);
			return promiseChain.then(() => {
				logger.silly("promiseChain.then");
				return processCollection(collection);
			}).catch(error => {
				//When processing multiple collections, we always return success to the command line. 
				//Errors are in the collections array we just printed to the log, and in each collection folder.
				logger.error("unable to process collection: " + global.pp(error));
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
		//return processCollection(collection);
		processCollection(collection).catch(eror => {
			//When processing a single collection, we want to return any failure to the command line.
			logger.error("returning failure");
			process.exit(1);});
	}
}).then(() => {
	logger.debug("Closing pgp");
	pgp.end();
}).catch((error) => {
	logger.error(error);
	pgp.end();
});


function processCollection(collection)  {
	const source = path.join(global.args.source, collection.path);
	logger.silly("source = " + source);

	return new Promise((resolve, reject) => {
		logger.debug("processing collection " + source);

		global.datasetName = source.split("/").pop(); //The last element in the path

		const dir = path.join(source, "metadata");

		//Verify that directory exists
		if (!fs.existsSync(dir)) {
			return reject("No top level metadata directory found for collection");
		}
		logger.silly("metadata directory exists");

		const files = fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory());
		//filter out files that don't end in "xml", and files that don't meet naming requirement
	 	const validFiles = files.filter( f => (f.split('.')[f.split('.').length-1].toUpperCase() === "XML") &&
												["ISO19115", "ISO19139"].includes(f.split('.')[0].split('-')[0].toUpperCase()));
		logger.silly("files = " + global.pp(files));
		logger.silly("validFiles = " + global.pp(validFiles));

		if (files.length !== validFiles.length) {
			logger.warn("Invalid metadata files ignored under " + dir);
		}

		if (validFiles.length === 0) {
			return reject("No suitable top level metadata files found for collection");
		}

		if (validFiles.length > 1) {
			return reject("Found more than one valid metadata file");
		}

		const file = validFiles[0];

		const fileMetadataType = file.split('.')[0].split('-')[0].toUpperCase();

		//read xml file
		const xmlPath = path.resolve(dir, file);

		const util = require("util");

		const readFilePromise = util.promisify(fs.readFile);
		return readFilePromise(xmlPath, 'utf-8')
		.catch(error => {logger.warn("no xml data in " + file + ": " + error);return Promise.reject(error);})
		.then((data) => {      
			logger.silly("processing metadata content for " + file);
			logger.silly("data = " + global.pp(data));
			logger.silly(path.extname(file).toUpperCase());

			const xml = require("./xmlConverter");
			return xml.convert(data, fileMetadataType);
		}).catch(error => {
			logger.warn("Problem parsing xml in " + file + ": " + global.pp(error)); 
			//return Promise.reject(error);
		}).then((data) => {
			const readDir = require("recursive-readdir");
			return readDir(source).then(filePaths => {
				logger.silly("filePaths = " + global.pp(filePaths));
				const azgs = require("./azgsMetadata");
				const fileEntries = filePaths.reduce((accF, f) => {
					logger.silly("dirname = " + path.dirname(f));
					const fileMeta = new azgs.File();
					if (path.dirname(f).includes(path.sep + "images")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "images";
						fileMeta.extension = path.extname(f);
					} else if (path.dirname(f).includes(path.sep + "documents")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "documents";
						fileMeta.extension = path.extname(f);
					} else if (path.dirname(f).includes(path.sep + "notes")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "notes";
						fileMeta.extension = path.extname(f);
					} else if (path.dirname(f).includes(path.sep + "legacy")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "legacy";
						fileMeta.extension = path.extname(f);
					} else if (path.dirname(f).includes(path.sep + "raster")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "raster";
						fileMeta.extension = path.extname(f);
					} else if (path.dirname(f).includes(path.sep + "ncgmp09")) {
						if (!path.dirname(f).includes(".gdb")) {
							fileMeta.name = path.basename(f);
							fileMeta.type = "ncgmp09";
							fileMeta.extension = path.extname(f);
						} else if (path.dirname(f).includes(path.sep + "ncgmp09" + path.sep)) {
							logger.silly("ncgmp09 thing = " + f);
							fileMeta.name = path.basename(path.dirname(f));
							fileMeta.type = "ncgmp09";
							fileMeta.extension = path.extname(path.basename(path.dirname(f)));
						}
					} else if (path.dirname(f).includes(path.sep + "metadata")) {
						fileMeta.name = path.basename(f);
						fileMeta.type = "metadata";
						fileMeta.extension = path.extname(f);
					} else {
						fileMeta.name = path.basename(f);
						fileMeta.type = "unknown";
						fileMeta.extension = path.extname(f);
					}
					if (fileMeta.extension !== ".gdb" || !accF.some(e => e.name === fileMeta.name)) {
						return accF.concat(fileMeta);
					} else {
						return accF;
					}
				}, []);
				data.files = fileEntries;
				return data;
			})
		}).then((data) => {
			if (global.args.old_dbname || global.args.new_dbname) {
				return require("./db").fetch(data);
			} else {
				return Promise.resolve(data);
			}
		}).then((data) => {
			logger.silly("json from " + file + " = " + global.pp(data));
			return fs.writeJson(path.join(source, "azgs.json"), data, {spaces:"\t"})
		}).then(() => {
			logger.info("successfully completed conversion for " + file);
			global.datasetName = undefined; 
			return resolve();
		});
	}).catch((error) => {
		logger.error(error);
		return reject(error);
	});
}



