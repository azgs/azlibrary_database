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

/*
	//return fs.copy(sourceDir, tmpDir).then(() => {
	return fs.ensureSymlink(sourceDir, tmpDir).then(() => {
		return tar.create({
			file: tmpDir + ".tar.gz",
			//prefix: collectionID,
			cwd: path.dirname(tmpDir),
			follow: true,
			gzip: true
		},[path.basename(tmpDir)]);
	}).then(() => {
 		return Promise.resolve(5);
	//TODO: update collection record with oid
*/


	//return fs.copy(sourceDir, tmpDir).then(() => {
	return fs.ensureSymlink(sourceDir, tmpDir).then(() => {
 		return man.createAndWritableStreamAsync(bufferSize)
		.then(([oid, loStream]) => { //recent EMCA weirdness: destructuring assignment
			logger.silly("oid = " + oid);

			const gzStream =  tar.create({
				//file: tmpDir + ".tar.gz",
				//prefix: collectionID,
				cwd: path.dirname(tmpDir),
				follow: true,
				gzip: true
			},[path.basename(tmpDir)]);

			gzStream.pipe(loStream);
			return new Promise((resolve, reject) => {
				//gzStream.on('data', (chunk) => {
				//  logger.silly(`Received ${chunk.length} bytes of data.`);
				//});
				loStream.on('finish', () => {
					logger.silly("stream finished");
					return resolve(oid)
				});
				loStream.on('error', () => {
					logger.silly("stream error");
					return reject();
				});
			});
		}).catch(error => {
			logger.error("There's been a catastrophe! " + global.pp(error));
			return Promise.reject(error);
		});
	//TODO: update collection record with oid


/*
	}).then((oid) => { //Now read it back in and write to file to verify
		logger.silly("oid later = " + oid);
		return man.openAndReadableStreamAsync(oid, bufferSize)
		.then(([size, loStream]) => {
			logger.silly("Streaming large object with size " + size);
			const fileStream = fs.createWriteStream(path.join(destDir, ""+collectionID) + ".tar.gz");
			loStream.pipe(fileStream);

			return new Promise((resolve, reject) => {
		  		loStream.on('end', resolve);
		  		loStream.on('error', reject);
			});
	  	});
*/
/*
	}).then(() => {
		return fs.remove(sourceDir);
*/
	}).then((oid) => {
		logger.silly("done archiving oid = " + oid);
		//return Promise.resolve();
		return fs.remove(tmpDir).then(() => {
			return Promise.resolve(oid);
		});
	}).catch(error => {
		logger.error("Problem creating archive: " + global.pp(error));
		return Promise.reject(error);
	});

}

