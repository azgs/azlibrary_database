exports.upload = (dir, collectionID, db) => {
	console.log("processing documents");

	dir = dir + "/documents";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No documents directory found");
		return Promise.resolve();
	}

	//const fs = require('fs');
	const path = require('path');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	console.log("files = "); console.log(files);

	//only interested in pdfs for now
	//files = files.filter(file => file.split('.')[file.split('.').length-1].toUpperCase() === "PDF"); 
	files = files.filter(file => {
		const suffix = file.split('.')[file.split('.').length-1].toUpperCase();
		return (suffix === "PDF" || suffix === "DOC" || suffix === "DOCX" || suffix === "TXT");
	}); 

	return require("./metadata").upload(dir, "documents", collectionID, db)
	.then((metadataIDs) => {
		//If metadataIDs is undefined, give it an empty array to keep later code happy
		metadataIDs = (metadataIDs ? metadataIDs : []);

		console.log("metadataIDs =");console.log(metadataIDs);

		//strip away prefix and filetype. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		/*
		//Process each file
		const promises = files.map((file) => {
			console.log("processing pdf file " + file);

			//Find metadata id that corresponds to this file
			let metadataID = metadataIDs.reduce((id, mID) => {
				if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
					return mID.metadataID;
				} else {
					return id;
				}
			}, null);

			const pdf = require('pdf-parse');
			let dataBuffer = fs.readFileSync(dir + "/" + file);
			return pdf(dataBuffer).then(data => {
				//console.log(data.text); 
				return db.none(
					"insert into documents.documents (collection_id, metadata_id, path, text_search) values (" +
					collectionID + ", " + 
					metadataID + ", " +
					"'" + dir + "/" + file + "', " +
					"to_tsvector($$" + data.text + "$$))"); 
			});
		});
		return Promise.all(promises);
		*/

		return db.tx(t => { //do insert inside a transaction

			//Process each file
			const inserts = files.map((file) => {
				console.log("processing pdf file " + file);

				//Find metadata id that corresponds to this file
				let metadataID = metadataIDs.reduce((id, mID) => {
					if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
						return mID.metadataID;
					} else {
						return id;
					}
				}, null);

				/*
				const pdf = require('pdf-parse');
				let dataBuffer = fs.readFileSync(dir + "/" + file);
				return pdf(dataBuffer).then(data => {
					//console.log(data.text); 
					return t.none(
						"insert into documents.documents (collection_id, metadata_id, path, text_search) values (" +
						collectionID + ", " + 
						metadataID + ", " +
						"'" + dir + "/" + file + "', " +
						"to_tsvector($$" + data.text + "$$))"); 
				});
				*/
				const textExtractor = require('./text_extractor');
				return textExtractor.extract(dir + "/" + file).then(data => {
					//console.log(data.text); 
					return t.none(
						"insert into documents.documents (collection_id, metadata_id, path, text_search) values (" +
						collectionID + ", " + 
						metadataID + ", " +
						"'" + dir + "/" + file + "', " +
						"to_tsvector($$" + data.text + "$$))"); 
				})
				.catch(error => {console.log("problem processing " + file); console.log(error); throw new Error(error);});

			});
			return t.batch(inserts).catch(error => {console.log(error);throw new Error(error);});
		});

	});
};
