exports.upload = (dir, datasetName, collectionID, db, dbName, user, password) => {
	console.log("processing geodata");

	dir = dir + "/geodata";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No geodata directory found");
		return Promise.resolve();
	}

	let geodataSchema;

	//const fs = require('fs');
	const path = require('path');
	const listDirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory());
	const dirs = listDirs(dir);
	console.log("dirs = ");console.log(dirs);

	const promises = dirs.map(thisDir => {
		if (thisDir.toLowerCase() === "metadata") {
			return require("./metadata").upload(dir, "geodata", collectionID, db);
		} else if (thisDir.toLowerCase() === "legacy") {
			return require("./legacy").upload(dir, collectionID, db);
		} else if (thisDir.toLowerCase() === "raster") {
			return require("./raster").upload(dir, collectionID, db);
		} else {
			return require("./gdb").upload(dir, thisDir, collectionID, db, dbName, user, password);
		}
	});

	return Promise.all(promises);
}




