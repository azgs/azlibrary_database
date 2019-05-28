const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.archive = (sourceDir, collectionID, tx) => {
	logger.debug("enter");
	logger.silly("sourceDir = " + sourceDir);

	const {LargeObjectManager} = require('pg-large-object');
	const man = new LargeObjectManager({pgPromise: tx});
	const bufferSize = 16384;

	const fs = require('fs-extra');
	const path = require("path");
	const tar = require("tar");

	const tmpDir = path.join(path.dirname(sourceDir), collectionID);
	logger.silly("tmpDir = " + tmpDir);

	return fs.ensureSymlink(sourceDir, tmpDir).then(() => { 
 		return man.createAndWritableStreamAsync(bufferSize)
		.then(([oid, loStream]) => { //recent EMCA weirdness: destructuring assignment
			logger.silly("oid = " + oid);

			const gzStream =  tar.create({
				cwd: path.dirname(tmpDir),
				follow: true,
				gzip: true
			},[path.basename(tmpDir)]);

			gzStream.pipe(loStream);
			return new Promise((resolve, reject) => {
				//gzStream.on('data', (chunk) => { //For testing
				//  logger.silly(`Received ${chunk.length} bytes of data.`);
				//});
				loStream.on('finish', () => {
					logger.silly("stream finished");
					return resolve(oid)
				});
				loStream.on('error', (error) => {
					logger.silly("stream error: " + global.pp(error));
					return reject(error);
				});
			});
		});
	}).then((oid) => {
		//clean up and return oid
		logger.silly("done archiving oid = " + oid);
		return fs.remove(tmpDir).then(() => {
			return Promise.resolve(oid);
		});
	}).catch(error => {
		logger.error("Problem creating archive: " + global.pp(error));
		return fs.remove(tmpDir).then(() => {return Promise.reject(error);});
	});

}

