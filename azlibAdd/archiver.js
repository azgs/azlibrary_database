const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.archive = (sourceDir, destDir) => {
	logger.debug("enter");
	logger.silly("sourceDir = " + sourceDir);
	logger.silly("destDir = " + destDir);

	return new Promise((resolve, reject) => {
		try {
			const fs = require('fs-extra');
			const util = require("util");
			const path = require("path");

			const zlib = require('zlib');
			const gzipper = zlib.createGzip();

			fs.ensureDir(destDir).then(() => {

				const gz = fs.createWriteStream(path.join(destDir, path.basename(sourceDir) + ".tar.gz"));

				const tarrer = require("tar-fs");
				tarrer.pack(sourceDir).pipe(gzipper).pipe(gz); 

				gz.on('finish', () => {
					fs.remove(sourceDir).then(() => {
						resolve();
					}).catch(err => {
						logger.error("Problem removing directory");
						logger.error(err);
						throw new Error(err);
					});
				});
			});
		} catch(err) {
			reject(err);
		}
	});
}

