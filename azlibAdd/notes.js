exports.upload = (rootDir, collectionID, db) => {	
	console.log("processing notes");

	const path = require('path');

	const myDir = "notes";
	const dir = path.join(rootDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No notes directory found");
		return Promise.resolve();
	}

	//return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "notes", collectionID, db);

	let files = [];
	try {
		files = fs.readdirSync(dir).filter(f => !fs.statSync(path.join(dir, f)).isDirectory());
	} catch(err) {
		return Promise.reject("Problem accessing notes directory: " + err);
	}
	console.log("notes files = "); console.log(files);

	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "notes", collectionID, db)
	.then((metadataIDs) => {
		//If metadataIDs is undefined, give it an empty array to keep later code happy
		metadataIDs = (metadataIDs ? metadataIDs : []);

		console.log("notes metadataIDs =");console.log(metadataIDs);

		//strip away prefix and filetype. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		return db.tx(t => { //do insert inside a transaction

			//Process each file
			const inserts = files.map((file) => {
				console.log("processing note file " + file);

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
					"'" + path.join(myDir, file) + "')")
				.catch(error => {console.log("problem creating db record for " + file); console.log(error); throw new Error(error);}); 
			});
			return t.batch(inserts).catch(error => {console.log(error);throw new Error(error);});
		});
	});
};
