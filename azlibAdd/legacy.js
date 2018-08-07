const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	return Promise.resolve()
	.then(() => {
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
		
			//ignore hidden files
			subElements = subElements.filter(sE =>! /^\..*/.test(sE)); 
			logger.silly("filtered subElements = " + global.pp(subElements));		

			//First process metadata, keeping track of filename-ID mapping
			return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "gisdata", collectionID, db)
			.then((metadataIDs) => {
				//If metadataIDs is undefined, give it an empty array to keep later code happy
				metadataIDs = (metadataIDs ? metadataIDs : []);
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

					return statPromise(path.join(dir,element)).then(stats => {
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

						//TODO: Maybe store extent in global from metadata.js to avoid trip to db here.
						return fetchExtent(collectionID, dir, file, db)
						.then((extent) => {
							logger.silly(file + " extent after srid tweaking = " + global.pp(extent));

							//Insert legacy record for this file, creating bbox from extent
							return db.none("insert into gisdata.legacy (collection_id, metadata_id, name, path, geom, bbox_from_meta) values (" +
											collectionID + "," +
											metadataID + "," + 
											"null," + //TODO: what to use for name?
											"'" + path.join(intermediateDir, myDir, file) + "'," +
											"ST_MakeEnvelope(" + extent.extent.minX + "," + extent.extent.minY + "," + extent.extent.maxX + "," + extent.extent.maxY + "," + extent.extent.srid + ")," +
											extent.fromMeta + 
							")").catch(error => {logger.error("problem inserting legacy record:");logger.error(error); return Promise.reject(error);});
						}).catch((error) => {
							logger.error("Problem creating legacy record for collection " + collectionID + ", file " + file);
							logger.error(error);
							return Promise.reject(error);
						});
					}).catch(error => {logger.error("problem getting stats for element " + element);logger.error(error); return Promise.reject(error);});
				})
				return Promise.all(promises).catch(error => {logger.error("Problem processing legacy files");logger.error(error); return Promise.reject(error);});
			}).catch(error => {logger.error("problem getting dir list");logger.error(error); return Promise.reject(error);});
		}).catch(error => {logger.error("problem getting directory content");logger.error(error); return Promise.reject(error);});
	}).catch(error => {
		logger.error("problem handling legacy directory. " + global.pp(error));
		return Promise.reject(error);
	});
};


function fetchExtent(collectionID, dir, file, db) {
	logger.silly("enter fetchExtent");
	return new Promise((resolve, reject) => {
		let extent;
		//Use gdal to get extent and srs (from first layer)
		try {
			logger.silly("running gdal");
			const gdal = require("gdal");
			const dataset = gdal.open(dir + "/" + file);
			const layer = dataset.layers.get(0); logger.silly("layer = " + global.pp(layer));
			extent = layer.getExtent(); logger.silly("extent = " + global.pp(extent));
			extent.srid = (layer.srs ? layer.srs.toProj4() : 'null'); logger.silly("layer.srs = " + layer.srs);

			//convert srid string into actual srid			
			db.one("select srid from public.spatial_ref_sys where trim(proj4text) = trim('" + extent.srid + "')")
			.then((data) => {
				extent.srid = (data === null ? null : data.srid);
				logger.silly("getExtentPromise, extent.srid = " + extent.srid);
				resolve({extent: extent, fromMeta:false});
			})
			.catch((error) => {
				logger.warn("Cannot find srid for " + extent.srid + ". " + error);
				reject(error);
			});

		//gdal failed, so use extent from top-level metadata
		} catch (err) {
			logger.warn("Problem with gdal for " + file + ": " + global.pp(err));
			db.one('select ST_XMin(geom) as "minX", ST_YMin(geom) as "minY", ST_XMax(geom) as "maxX", ST_YMax(geom) as "maxY", ST_SRID(geom) as srid from metadata.metadata where collection_id = ' + collectionID)
			.then((data) => {
				resolve({extent:data, fromMeta:true});
			})
			.catch((error) => {
				logger.warn("Problem getting metadata extent: " + global.pp(error));
				reject("Can't find extent for collection");
			});
		}
	});
}

