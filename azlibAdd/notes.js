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

	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "notes", collectionID, db);

};
