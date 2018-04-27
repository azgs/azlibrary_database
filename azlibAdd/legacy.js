exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	console.log("processing legacy geodata");

	const path = require('path');

	const myDir = "legacy";
	const dir = path.join(rootDir, intermediateDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No legacy directory found");
		return Promise.resolve();
	}

	const util = require('util');

	const statPromise = util.promisify(fs.stat);
	const readdirPromise = util.promisify(fs.readdir);

	return readdirPromise(dir).then(subElements => {
		console.log("subElements = "); console.log(subElements);

		//First process metadata, keeping track of filename-ID mapping
		return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "geodata", collectionID, db)
		.then((metadataIDs) => {
			console.log("legacy metadataIDs = "); console.log(metadataIDs);
	
			//strip away prefix and filetype from metadata ID mappings. Only interested in name
			metadataIDs = metadataIDs.map(mID => {
				mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
				return mID;
			});
			console.log("legacy metadataIDs stripped = "); console.log(metadataIDs);

			//Process each legacy file/dir
			const promises = subElements.map((element) => {
				console.log("processing legacy element " + element);

				let file = element;

				statPromise(path.join(dir,element)).then(stats => {
					const suffix = element.split('.')[element.split('.').length-1].toUpperCase();
					if (stats.isDirectory()) {
						if (suffix === "SHP") {
							console.log("processing legacy shape directory " + element);

							try {
								const files = fs.readdirSync(path.join(dir, element)).filter(f => f.split('.')[f.split('.').length-1].toUpperCase() === "SHP");
								file = path.join(element, files[0]);
								//console.log(file);
							} catch(err) {
								console.log("Can't find shp file in directory " + element + ". Ignoring directory");
								console.log(err);
								return Promise.resolve();
							}
						} else {
							console.log("legacy directory " + element + " is not a shape directory. Ignoring");
							return Promise.resolve();
						}
					} else if (suffix === "SHP" || suffix === "DBF" || suffix === "PRJ" || suffix === "SHX" || suffix === "QPJ") {
						console.log("Shape files must be contained in a directory. Ignoring " + file);
						return Promise.resolve();
					}

					console.log("processing legacy file " + file);
					
					//Find metadata id that corresponds to this file
					let metadataID = metadataIDs.reduce((id, mID) => {
						if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
							return mID.metadataID;
						} else {
							return id;
						}
					}, null);
					console.log("metadataID = " + metadataID);
					if (metadataID === null) {
						console.log("WARNING: No metadata file found for legacy file " + file);
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
						console.log("Problem with gdal for " + file);console.log(err);console.log("Ignoring file.");
						return Promise.resolve();
					}

					//Get srid
					return db.oneOrNone("select srid from public.spatial_ref_sys where trim(proj4text) = trim('" + srs + "')")
					.then((data) => {
						const srid = (data === null ? null : data.srid);
						console.log("srid = " + srid);

						//Insert legacy record for this file, creating bbox from extent
						return db.none("insert into geodata.legacy (collection_id, metadata_id, name, path, geom) values (" +
										collectionID + "," +
										metadataID + "," + 
										"null," + //TODO: what to use for name?
										"'" + path.join(intermediateDir, myDir, file) + "'," +
										"ST_MakeEnvelope(" + extent.minX + "," + extent.minY + "," + extent.maxX + "," + extent.maxY + "," + srid + ")" +
						")").catch(error => {console.log("problem inserting legacy record:");console.log(error); throw new Error(error);});
					}).catch(error => {console.log("problem obtaining srid:");console.log(error); throw new Error(error);});
				}).catch(error => {console.log("problem getting stats for element " + element);console.log(error); throw new Error(error);});;
			});
			return Promise.all(promises).catch(error => {console.log("Problem processing legacy files");console.log(error); throw new Error(error);});
		}).catch(error => {console.log("problem processing metadata");console.log(error); throw new Error(error);});
	}).catch(error => {console.log("problem getting directory content");console.log(error); throw new Error(error);});
};



