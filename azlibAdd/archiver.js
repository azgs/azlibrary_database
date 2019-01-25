const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.archive = (sourceDir, destDir, collectionID) => {
	logger.debug("enter");
	logger.silly("sourceDir = " + sourceDir);
	logger.silly("destDir = " + destDir);

	const fs = require('fs-extra');
	const path = require("path");
	const tar = require("tar");
	return fs.ensureDir(destDir).then(() => {
		return tar.create({
			file: path.join(destDir, ""+collectionID) + ".tar.gz",
			cwd: path.dirname(sourceDir),
			gzip: true
		}, [path.basename(sourceDir)]);
	}).then(() => {
		return fs.remove(sourceDir);
	}).catch(error => {
		logger.error("Problem creating archive: " + global.pp(error));
		return Promise.reject(error);
	});

}

