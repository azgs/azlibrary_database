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

	files = files.filter(file => file.split('.')[file.split('.').length-1].toUpperCase() === "PDF"); 

	//Process each file
	const promises = files.map((file) => {
		console.log("processing pdf file " + file);

		const pdf = require('pdf-parse');
		let dataBuffer = fs.readFileSync(dir + "/" + file);
		return pdf(dataBuffer).then(data => {
			//console.log(data.text); 
			return db.none(
				"insert into documents.documents (collection_id, azgs_path, text_search, restricted) values (" +
				collectionID + ", " + 
				"'" + dir + "/" + file + "', " +
				"to_tsvector($$" + data.text + "$$), " +
				"'false')"); 
		});
	});
	return Promise.all(promises).then(() => {
		return require("./metadata").upload(dir, "documents", collectionID, db);
	});
};
