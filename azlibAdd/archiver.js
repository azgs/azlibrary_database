exports.archive = (dir) => {
	console.log("archiving");

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
					console.log("Problem removing directory");
					console.log(err);
					throw new Error(err);
				});
			});
		} catch(err) {
			reject(err);
		}
	});
}

