const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, schemaName, collectionID, db) => {
	logger.debug("enter");

	logger.debug("inter dir = " + intermediateDir);
	const myDir = "metadata";

	const path = require('path');
	const dir = path.join(rootDir, intermediateDir, myDir);

	//Verify that directory exists
	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		if (intermediateDir) {		
			return Promise.resolve();
		} else {
			return Promise.reject("No top level metadata directory found for collection");
		}
	}

	const idReturn = [];

	const files = fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory());
	//filter out files that don't end in "xml", and files that don't meet naming requirement
 	const validFiles = files.filter( f => (f.split('.')[f.split('.').length-1].toUpperCase() === "XML" ||
											f.split('.')[f.split('.').length-1].toUpperCase() === "JSON") &&
											global.metadataTypes.map(mType => {return mType.name}).includes(f.split('.')[0].split('-')[0].toUpperCase()));
	logger.silly("files = " + global.pp(files));
	logger.silly("validFiles = " + global.pp(validFiles));

	if (files.length !== validFiles.length) {
		logger.warn("Invalid metadata files ignored under " + path.join(intermediateDir, myDir));
	}

	if (!intermediateDir && validFiles.length === 0) {
		return Promise.reject("No suitable top level metadata files found for collection");
	}

	//Process each file
	const promises = validFiles.map((file) => {
		logger.silly("file = " + file);

		//read xml file
		const xmlPath = path.resolve(dir, file);//process.cwd() + "/" + dir + "/" + file;

		const util = require("util");

		const readFilePromise = util.promisify(fs.readFile);
		return readFilePromise(xmlPath, 'utf-8')
		.catch(error => {logger.warn("no xml data in " + file + ": " + error);return Promise.reject(error);})
		.then((data) => {      
			logger.silly("processing xml content for " + file);
			
			logger.silly(path.extname(file).toUpperCase());
			if (".JSON" === path.extname(file).toUpperCase()) {
				logger.silly("json file");
				return JSON.parse(data);
			}

			const xml2js = util.promisify(require('xml2js').parseString);
			return xml2js(data).catch(error => {logger.warn("Problem parsing xml in " + file + ": " + error); return Promise.reject(error);})
		}).then((data) => {
			logger.silly("json from metadata in " + file + " = " + global.pp(data));

			let metadataInsert, collectionsUpdate; 

			//If not top level metadata file					
			if (intermediateDir) {
				logger.silly("This has intermediateDir: " + intermediateDir);
				metadataInsert = 
					"insert into " + schemaName + ".metadata (collection_id, type, json_data, metadata_file) values (" +
					collectionID + ", $$" + 
					type + "$$, $$" + 
					JSON.stringify(data) + "$$, $$" +
					path.join(intermediateDir, myDir, file) + "$$) returning metadata_id";
			} else {
				const fileMetadataType = file.split('.')[0].split('-')[0].toUpperCase();
				if (global.metadataTypes.filter(t => t.formalNamePath).map(t => t.name)
					.includes(fileMetadataType)) {
					const metadataType = global.metadataTypes.filter(t => t.name === fileMetadataType)[0];

					try {
						logger.silly("title path = " + jsonQueryPathToArrayPath(metadataType.formalNamePath));
						const title = eval("data" + jsonQueryPathToArrayPath(metadataType.formalNamePath));
						logger.silly("title = " + title);

						collectionsUpdate = "update collections set formal_name = $$" + title + "$$ where collection_id = " + collectionID;
					} catch (error) {
						throw new Error("Could not determine formal name for collection from metadata");
					}
				
					try {
						const minX = eval("data" + jsonQueryPathToArrayPath(metadataType.xMinPath));
						const maxX = eval("data" + jsonQueryPathToArrayPath(metadataType.xMaxPath));
						const minY = eval("data" + jsonQueryPathToArrayPath(metadataType.yMinPath));
						const maxY = eval("data" + jsonQueryPathToArrayPath(metadataType.yMaxPath));
				
						logger.silly("bbox = " + minX + ", " + minY + ", " + maxX + ", " + maxY);
						metadataInsert = 
							"insert into " + schemaName + ".metadata (collection_id, type, json_data, metadata_file, geom) values (" +
							collectionID + ", $$" + 
							fileMetadataType + "$$, $$" + 
							JSON.stringify(data) + "$$, $$" +
							path.join(intermediateDir, myDir, file) + "$$, " +
							"ST_MakeEnvelope(" + minX + "," + minY + "," + maxX + "," + maxY + ",4326)) returning metadata_id";
					} catch (error) {
						throw new Error("Could not determine geographic bounding box for collection from metadata: " + global.pp(error));
					}
				} else {
					throw new Error("Unrecognized top-level xml format. Can't create insert statement.");
				}
			}
			logger.silly("insert for " + file + " = " + metadataInsert);

			return db.one(metadataInsert)
			.catch(error => {
				logger.error("Problem inserting metadata record: " + global.pp(error));
				return Promise.reject("Problem inserting metadata record: " + error);
			})
			.then((data) => {
				idReturn.push({file: file, metadataID: data.metadata_id});
				//Update formal_name in collections from the json metadata
				if (collectionsUpdate) {
					logger.silly("Top level metadata, so updating collections");
					return db.none(collectionsUpdate).catch(error => {
						logger.error("Problem updating formal_name in collections: " + global.pp(error));
						return Promise.reject(error);
					});
				} else { //not a top level metadata file; don't update collections
					logger.silly("Not top level metadata, so not updating collections");
					return Promise.resolve();
				}
			})
		});

	});
	return Promise.all(promises)
	.catch(error => {
		logger.error("Problem processing metadata for " + schemaName + ": " + global.pp(error)); 
		return Promise.reject(error);
	}).then(() => Promise.resolve(idReturn));
}


function jsonQueryPathToArrayPath(jsonQPath) {
	if (jsonQPath) {
		//slice off json_data prefix if present
		if (jsonQPath.startsWith("json_data->")) {
			jsonQPath = jsonQPath.slice(11);
		}
		if (jsonQPath.startsWith(">")) { //TODO: consolidate with previous
			jsonQPath = jsonQPath.slice(1);
		}
		const regex =/(.+?)(->{1,2}|$)/gm;
		return jsonQPath.replace(regex, (a, b) => {
			return '[' + b.trim() + ']';
		});
	}
	throw new Error("JSON query path not defined");
}



