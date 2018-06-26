const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	logger.debug("enter");

	//const path = require('path');

	const myDir = "legacy";
	const dir = path.join(rootDir, intermediateDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No legacy directory found");
		return Promise.resolve();
	}

	const util = require('util');

	const statPromise = util.promisify(fs.stat);
	const readdirPromise = util.promisify(fs.readdir);

	return readdirPromise(dir).then(subElements => {
		logger.silly("subElements = " + global.pp(subElements));

		//First process metadata, keeping track of filename-ID mapping
		return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "gisdata", collectionID, db)
		.then((metadataIDs) => {
			logger.silly("legacy metadataIDs = " + global.pp(metadataIDs));
	
			//strip away prefix and filetype from metadata ID mappings. Only interested in name
			metadataIDs = metadataIDs.map(mID => {
				mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
				return mID;
			});
			logger.silly("legacy metadataIDs stripped = " + global.pp(metadataIDs));

			//Process each legacy file/dir
			const promises = subElements.map((element) => {
				logger.silly("processing legacy element " + element);

				let file = element;

				statPromise(path.join(dir,element)).then(stats => {
					const suffix = element.split('.')[element.split('.').length-1].toUpperCase();
					if (stats.isDirectory()) {
						if (suffix === "SHP") {
							logger.silly("processing legacy shape directory " + element);

							try {
								const files = fs.readdirSync(path.join(dir, element)).filter(f => f.split('.')[f.split('.').length-1].toUpperCase() === "SHP");
								file = path.join(element, files[0]);
								//console.log(file);
							} catch(err) {
								logger.warn("Can't find shp file in directory " + element + ". Ignoring directory");
								logger.warn(err);
								return Promise.resolve();
							}
						} else {
							logger.warn("legacy directory " + element + " is not a shape directory. Ignoring");
							return Promise.resolve();
						}
					} else if (suffix === "SHP" || suffix === "DBF" || suffix === "PRJ" || suffix === "SHX" || suffix === "QPJ") {
						logger.warn("Shape files must be contained in a directory. Ignoring " + file);
						return Promise.resolve();
					}

					logger.silly("processing legacy file " + file);
					
					//Find metadata id that corresponds to this file
					let metadataID = metadataIDs.reduce((id, mID) => {
						if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
							return mID.metadataID;
						} else {
							return id;
						}
					}, null);
					logger.silly("metadataID = " + metadataID);
					if (metadataID === null) {
						logger.warn("No metadata file found for legacy file " + file);
					}

					let srs;
					let extent;
					//Use gdal to get extent and srs (from first layer)
					try {
						const gdal = require("gdal");
						const dataset = gdal.open(dir + "/" + file);
						const layer = dataset.layers.get(0);
						extent = layer.getExtent();
						srs = (layer.srs ? layer.srs.toProj4() : 'null');
					} catch (err) {
						logger.warn("Problem with gdal for " + file + ": " + global.pp(err));console.log("Ignoring file.");
						return Promise.resolve();
					}

					//Get srid
					return db.oneOrNone("select srid from public.spatial_ref_sys where trim(proj4text) = trim('" + srs + "')")
					.then((data) => {
						const srid = (data === null ? null : data.srid);
						logger.silly("srid = " + srid);

						//Insert legacy record for this file, creating bbox from extent
						return db.none("insert into gisdata.legacy (collection_id, metadata_id, name, path, geom) values (" +
										collectionID + "," +
										metadataID + "," + 
										"null," + //TODO: what to use for name?
										"'" + path.join(intermediateDir, myDir, file) + "'," +
										"ST_MakeEnvelope(" + extent.minX + "," + extent.minY + "," + extent.maxX + "," + extent.maxY + "," + srid + ")" +
						")").catch(error => {logger.error("problem inserting legacy record:");logger.error(error); throw new Error(error);});
					}).catch(error => {logger.error("problem obtaining srid:");logger.error(error); throw new Error(error);});
				}).catch(error => {logger.error("problem getting stats for element " + element);logger.error(error); throw new Error(error);});;
			});
			return Promise.all(promises).catch(error => {logger.error("Problem processing legacy files");logger.error(error); throw new Error(error);});
		}).catch(error => {logger.error("problem processing metadata");logger.error(error); throw new Error(error);});
	}).catch(error => {logger.error("problem getting directory content");logger.error(error); throw new Error(error);});
};



