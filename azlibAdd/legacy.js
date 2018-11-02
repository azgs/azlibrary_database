const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	logger.debug("enter");

	//const path = require('path');

	const myDir = "legacy";
	const dir = path.join(rootDir, intermediateDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No legacy directory found");
		return Promise.resolve();
	}

	let files = [];
	try {
		files = fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory() && ! /^\..*/.test(f));
	} catch(err) {
		return Promise.reject("Problem accessing legacy directory: " + err);
	}
	logger.debug("files = " + global.pp(files));

	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "legacy", collectionID, db)
	.then((metadataIDs) => {
		//If metadataIDs is undefined, give it an empty array to keep later code happy
		metadataIDs = (metadataIDs ? metadataIDs : []);

		logger.debug("legacy metadataIDs = " + global.pp(metadataIDs));

		//strip away prefix and filetype. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});
	
		return db.tx(t => { //do insert inside a transaction

			//Process each file
			const inserts = files.map((file) => {
				logger.debug("processing image file " + file);

				//Find metadata id that corresponds to this file
				let metadataID = metadataIDs.reduce((id, mID) => {
					if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
						return mID.metadataID;
					} else {
						return id;
					}
				}, null);

				return t.none(
					"insert into gisdata.legacy (collection_id, metadata_id, path) values (" +
					collectionID + ", " + 
					metadataID + ", " +
					"'" + path.join(intermediateDir, myDir, file) + "')")
				.catch(error => {logger.error("problem creating db record for " + file + ": " + error); throw new Error(error);}); 
			});
			return t.batch(inserts).catch(error => {logger.error(error);throw new Error(error);});
		});
	});
};
