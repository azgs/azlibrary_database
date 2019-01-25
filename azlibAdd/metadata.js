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
		return Promise.resolve();
	}

	const idReturn = [];

	const files = fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory());
	//filter out files that don't end in "xml" or "json", and files that don't meet naming requirement
 	const validFiles = files.filter( f => ((f.split('.')[f.split('.').length-1].toUpperCase() === "XML" ||
											f.split('.')[f.split('.').length-1].toUpperCase() === "JSON")) &&
											["ISO19115", "ISO19139"].includes(f.split('.')[0].split('-')[0].toUpperCase()));



	logger.silly("files = " + global.pp(files));
	logger.silly("validFiles = " + global.pp(validFiles));

	if (files.length !== validFiles.length) {
		logger.warn("Invalid metadata files ignored under " + path.join(intermediateDir, myDir));
	}

	//Process each file
	const promises = validFiles.map((file) => {
		logger.silly("file = " + file);

		const fileMetadataType = file.split('.')[0].split('-')[0].toUpperCase();

		//read xml file
		const xmlPath = path.resolve(dir, file);

		let metadataInsert = 
				"insert into " + schemaName + ".metadata (collection_id, metadata_file) values (" +
				collectionID + ", $$" + 
				path.join(intermediateDir, myDir, file) + "$$) returning metadata_id";
		logger.silly("insert for " + file + " = " + metadataInsert);

		return db.one(metadataInsert)
		.catch(error => {
			logger.error("Problem inserting metadata record: " + global.pp(error));
			return Promise.reject("Problem inserting metadata record: " + error);
		})
		.then((data) => {
			idReturn.push({file: file, metadataID: data.metadata_id});
			return Promise.resolve();
		})

	});
	return Promise.all(promises)
	.catch(error => {
		logger.error("Problem processing metadata for " + schemaName + ": " + global.pp(error)); 
		return Promise.reject(error);
	}).then(() => Promise.resolve(idReturn));
}



