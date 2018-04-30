exports.upload = (rootDir, datasetName, collectionID, db, dbName, user, password) => {
	console.log("processing gisdata");

	const path = require('path');

	const myDir = "gisdata";
	const dir = path.join(rootDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No gisdata directory found");
		return Promise.resolve();
	}

	let geodataSchema;

	//const fs = require('fs');
	const listDirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory());
	const dirs = listDirs(dir);
	console.log("dirs = ");console.log(dirs);

	const promises = dirs.map(thisDir => {
		if (thisDir.toLowerCase() === "metadata") {
			return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "gisdata", collectionID, db);
		} else if (thisDir.toLowerCase() === "legacy") {
			return require("./legacy").upload(rootDir, path.relative(rootDir, dir), collectionID, db);
		} else if (thisDir.toLowerCase() === "raster") {
			return require("./raster").upload(rootDir, path.relative(rootDir, dir), collectionID, db);
		} else {
			return require("./gdb").upload(dir, thisDir, collectionID, db, dbName, user, password);
		}
	});

	promiseUtil = require("./promise_util");
	return Promise.all(promises.map(promiseUtil.reflect)).then(results => {
		if (results.filter(result => result.status === "rejected").length === 0) {
			return Promise.resolve(results);
		} else {
			return Promise.reject(results);
		} 
	});

}




