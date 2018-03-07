exports.upload = (dir) => {
	console.log("processing documents");

	dir = dir + "/documents";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No documents directory found");
		return Promise.resolve();
	}

	return Promise.resolve();
};
