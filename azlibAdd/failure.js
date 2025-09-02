const path = require("path");
const logger = require("./logger")(path.basename(__filename));

const fs = require('fs-extra');
const util = require("util");


exports.process = (collection, source) => {
	logger.debug("enter");
	logger.silly("collection = " + global.pp(collection));

	return new Promise((resolve, reject) => {
		if (!global.args.failure_directory) {
			return fs.remove(source).catch((error) => {
				logger.error("Unable to remove failure source directory: " + global.pp(error));
				return reject(error);
			}
			//resolve();
		} else {
			const dest = path.join(global.args.failure_directory, (collection.permID ? collection.permID + "-" : "") + collection.uploadID);
			logger.silly("dest = " + dest);
			fs.ensureDir(global.args.failure_directory).then(() => {
				return fs.writeJson(path.join(source, "failure.json"), collection, {spaces:"\t"})
			}).then(() => {
				return fs.move(source, dest, { overwrite: true });
			}).catch((error) => {
				logger.error("Unable to move to failure directory: " + global.pp(error));
				return reject(error);
			}).then(() => {
				return resolve();
			});
		}
	});
}

