const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.fetch = (data) => {	
	logger.silly("enter, data = " + global.pp(data));

	const query = 
		"select informal_name, ua_library from public.collections where azgs_old_url like '%/" + global.datasetName + "'";
	logger.silly("query = " + query);
	return global.odb.one(query).then(result => {
		data.informal_name = result.informal_name;
		if (result.ua_library) {
		const azgs = require("./azgsMetadata");
			const link = new azgs.Link();
			link.url = result.ua_library;
			link.name = "UA Library";
			data.links.push(link);
		}
		return Promise.resolve();
	}).catch(error => {
		logger.warn("Unable to find collections record for " + global.datasetName + ": " + global.pp(error));
		return Promise.resolve();
	}).then(() => {
		const query = `
			select 
				cg.collection_group_name 
			from
				public.collection_groups cg join 
				public.initial_group_mapping igm on 
					cg.collection_group_name = igm.collection_group_name
			where azgs_old_url like $1
		`
		return global.ndb.one(query, ["%/" + global.datasetName]).then(result => {
			data.collection_group.name = result.collection_group_name;
			return Promise.resolve(data);
		});
	}).catch(error => {
		logger.warn("Unable to find collection group information for " + global.datasetName + ": " + global.pp(error));
		return Promise.resolve(data);
	});

};

