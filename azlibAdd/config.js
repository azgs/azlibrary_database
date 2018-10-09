const path = require("path");
const logger = require("./logger")(path.basename(__filename));

/*
global.pp = (object) => {
	logger.debug("typeof Object = " + typeof object);
	if (Array.isArray(object)) {
		return JSON.stringify(object, null, 4);
	} else {
		return object;
	}
};
*/

exports.load = (db) => {
	//console.log("loading config from db");
	logger.debug("enter");

	const promises = [
		db.any("select type_name from documents.types").then(data => {
			global.documentTypes = data.map(datum => {return datum.type_name});
			logger.debug("Doc types = " + global.documentTypes)
		}),
		db.any("select type_name from gisdata.raster_types").then(data => {
			global.rasterTypes = data.map(datum => {return datum.type_name});
			logger.debug("Raster types = " + global.rasterTypes)
		}),
		db.any("select * from metadata.types").then(data => {
			global.metadataTypes = data.map(datum => {
				return {
					name: datum.type_name, 
					formalNamePath: datum.title_query_path,
					xMinPath: datum.minx_query_path,
					xMaxPath: datum.maxx_query_path,
					yMinPath: datum.miny_query_path,
					yMaxPath: datum.maxy_query_path
				}
			});
			
			logger.debug("Metadata types = " + global.pp(global.metadataTypes));
			logger.debug("ISO path = " + metadataTypes[1].formalNamePath);
		})
	];

	return Promise.all(promises).catch(error => {
		logger.error("Problem loading config data from db: " + global.pp(error));
		throw new Error(error);
	});
}



