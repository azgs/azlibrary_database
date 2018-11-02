const path = require("path");
const logger = require("./logger")(path.basename(__filename));

const fs = require('fs-extra');
const util = require("util");


exports.process = (collection, source) => {
	logger.debug("enter");
	logger.silly("collection = " + collection);
	logger.silly("source = " + source);

	return new Promise((resolve, reject) => {
		if (!global.args.failure_directory) {
			resolve();
		} else {
			const dest = path.join(global.args.failure_directory, path.basename(source));
			logger.silly("dest = " + dest);
			fs.ensureDir(global.args.failure_directory).then(() => {
				return fs.writeJson(path.join(source, "failure.json"), collection, {spaces:"\t"})
			}).then(() => {
				return fs.move(source, dest);
			}).catch((error) => {
				reject(error);
			}).then(() => {
				resolve();
			});
		}
	});
}

