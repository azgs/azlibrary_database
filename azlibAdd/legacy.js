exports.upload = (dir, collectionID, db) => {
	console.log("processing legacy geodata");

	dir = dir + "/legacy";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No legacy directory found");
		return Promise.resolve();
	}

	return require("./metadata").upload(dir, "geodata", collectionID, db);

};
