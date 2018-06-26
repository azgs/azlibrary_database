const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.archive = (dir) => {
	logger.debug("enter");

	return new Promise((resolve, reject) => {
		try {
			const fs = require('fs-extra');
			const util = require("util");
			const path = require("path");

			const writeFileP = util.promisify(fs.writeFile);
			const rmrafP = util.promisify(fs.remove);

			const zlib = require('zlib');
			const gzipper = zlib.createGzip();

			const gz = fs.createWriteStream(path.join(path.dirname(dir), path.basename(dir) + ".tar.gz"));

			const tarrer = require("tar-fs");
			tarrer.pack(dir).pipe(gzipper).pipe(gz); 

			gz.on('finish', () => {
				rmrafP(dir).then(() => {
					resolve();
				}).catch(err => {
					logger.error("Problem removing directory");
					logger.error(err);
					throw new Error(err);
				});
			});
		} catch(err) {
			reject(err);
		}
	});
}

