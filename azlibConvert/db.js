const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.fetch = (data) => {	
	logger.silly("enter, data = " + global.pp(data));

	const query = 
		"select informal_name, ua_library from public.collections where azgs_old_url like '/%" + global.datasetName + "'";
	logger.silly("query = " + query);
	return global.db.one(query).then(result => {
		data.informal_name = result.informal_name;
		const azgs = require("./azgsMetadata");
		const link = new azgs.Link();
		link.url = result.ua_library;
		link.name = "UA Library";
		data.links.push(link);
		return Promise.resolve(data);
	}).catch(error => {
		logger.warn("Unable to find collections record for " + global.datasetName + ": " + global.pp(error));
		return Promise.resolve(data);
	});

};

