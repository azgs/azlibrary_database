exports.upload = (dir, collectionID, db) => {
	console.log("processing documents");

	dir = dir + "/documents";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No documents directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(dir, "documents", collectionID, db);
};
