const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, collectionID, db) => {
	logger.debug("enter");

	//const path = require('path');

	const myDir = "documents";
	const dir = path.join(rootDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No documents directory found");
		return Promise.resolve();
	}

	//const fs = require('fs');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	logger.silly("files = " + global.pp(files));

	//filter out unrecognized filetypes
	files = files.filter(file => {
		const suffix = file.split('.')[file.split('.').length-1].toUpperCase();
		return global.documentTypes.includes(suffix);
	}); 

	return require("./metadata").upload(dir, path.relative(rootDir, dir), collectionID, db)
	.then((metadataIDs) => {
		//If metadataIDs is undefined, give it an empty array to keep later code happy
		metadataIDs = (metadataIDs ? metadataIDs : []);

		logger.silly("metadataIDs = " + global.pp(metadataIDs));

		//strip away prefix and filetype. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		return db.tx(t => { //do insert inside a transaction

			//Process each file
			const inserts = files.map((file) => {
				logger.debug("processing document file " + file);

				//Find metadata id that corresponds to this file
				let metadataID = metadataIDs.reduce((id, mID) => {
					if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
						return mID.metadataID;
					} else {
						return id;
					}
				}, null);

				const textExtractor = require('./text_extractor');
				return textExtractor.extract(dir + "/" + file)
				.catch(error => {
					logger.error("problem extracting text from " + file);
		 			logger.error(error); 
					throw new Error(error);
				})
				.then(data => {
					logger.silly("data.text = " + data.text);
					data.text = data.text.replace(/\$+/g, "$"); //I can think of no valid reason for there to be "$$" in these strings, but cases have shown up. 
					const insert = "insert into documents.documents (collection_id, metadata_id, path, text_search) values (" +
						collectionID + ", " + 
						metadataID + ", " +
						"'" + path.join(myDir, file) + "', " +
						"to_tsvector($tsvector$" + data.text + "$tsvector$))";
					logger.silly("insert = " + insert);
					return t.none(insert)
					.catch(error => {
						logger.error("problem inserting record for " + file);
			 			logger.error(error); 
						throw new Error(error);
					});
				})
				.catch(error => {
					logger.error("problem creating insert for " + file);
		 			logger.error(error); 
					throw new Error(error);
				});
				

			});
			return t.batch(inserts).catch(error => {logger.error(error);throw new Error(error);});
		});

	});
};
