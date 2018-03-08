exports.upload = (dir, collectionID, db) => {
	console.log("processing images");

	dir = dir + "/images";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No images directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(dir, "images", collectionID, db);
};
