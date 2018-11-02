const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, collectionID, db) => {	
	logger.debug("enter");

	//const path = require('path');

	const myDir = "notes";
	const dir = path.join(rootDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No notes directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "notes", collectionID, db)
	.then((metadataIDs) => {
		//If metadataIDs is undefined, give it an empty array to keep later code happy
		metadataIDs = (metadataIDs ? metadataIDs : []);

		logger.silly("notes metadataIDs = " + global.pp(metadataIDs));

		//strip away prefix and filetype. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		let files = [];
		try {
			files = fs.readdirSync(path.join(dir, "misc")).filter(f => !fs.statSync(path.join(dir, "misc", f)).isDirectory());
		} catch(err) {
			return Promise.reject("Problem accessing notes directory: " + err);
		}
		logger.silly("notes/misc files = " + global.pp(files));

		return db.tx(t => { //do insert inside a transaction

			//Process each file
			const inserts = files.map((file) => {
				logger.debug("processing note file " + file);

				//Find metadata id that corresponds to this file
				let metadataID = metadataIDs.reduce((id, mID) => {
					if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
						return mID.metadataID;
					} else {
						return id;
					}
				}, null);

				return t.none(
					"insert into notes.misc_notes (collection_id, metadata_id, path) values (" +
					collectionID + ", " + 
					metadataID + ", " +
					"'" + path.join(myDir, "misc", file) + "')")
				.catch(error => {logger.error("problem creating db record for " + file); logger.error(error); throw new Error(error);}); 
			});
			return t.batch(inserts).catch(error => {logger.error(error);throw new Error(error);});
		});
	});
};
