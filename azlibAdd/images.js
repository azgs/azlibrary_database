exports.upload = (rootDir, collectionID, db) => {
	console.log("processing images");

	const path = require('path');

	const myDir = "images";
	const dir = path.join(rootDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No images directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "images", collectionID, db);
};
