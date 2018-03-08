exports.upload = (dir, collectionID, db) => {	
	console.log("processing notes");

	dir = dir + "/notes";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No notes directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(dir, "notes", collectionID, db);

};
