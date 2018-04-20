exports.upload = (dir, collectionID, db) => {
	console.log("processing legacy geodata");

	dir = dir + "/legacy";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No legacy directory found");
		return Promise.resolve();
	}

	const path = require('path');
	const util = require('util');

	const statPromise = util.promisify(fs.stat);
	const readdirPromise = util.promisify(fs.readdir);

	return readdirPromise(dir).then(subElements => {
		console.log("subElements = "); console.log(subElements);

		//First process metadata, keeping track of filename-ID mapping
		return require("./metadata").upload(dir, "geodata", collectionID, db)
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

				statPromise(path.join(dir,element)).then(stats => {
					if (stats.isDirectory()) {
						console.log("processing legacy directory " + element);
						return Promise.resolve();
					} else {
						console.log("processing legacy file " + element);
						let file = element;

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
							/*const*/ extent = layer.getExtent();
							/*const*/ srs = (layer.srs ? layer.srs.toProj4() : 'null');
						} catch (err) {
							console.log("Problem with gdal for " + file);console.log(err);console.log("Ignoring file.");
							return Promise.resolve();
						}

						/**
						try {
						console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
						const file2 = "stuff.dbf";
						const dataset2 = gdal.open(dir + "/" + file2);
						const layer2 = dataset2.layers.get(0);
						const extent2 = layer2.getExtent();
						const srs2 = (layer2.srs ? layer2.srs.toProj4() : 'null');
						console.log("file = " + file2);
						console.log("extent = ");console.log(extent2);
						console.log("srs = " + srs2);
						console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
						} catch (error) {
							console.log(error);
						}
						**/

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
											"'" + dir + "/" + file + "'," +
											"ST_MakeEnvelope(" + extent.minX + "," + extent.minY + "," + extent.maxX + "," + extent.maxY + "," + srid + ")" +
							")").catch(error => {console.log("problem inserting legacy record:");console.log(error); throw new Error(error);});
						}).catch(error => {console.log("problem obtaining srid:");console.log(error); throw new Error(error);});
					}		
				}).catch(error => {console.log("problem getting stats for element " + element);console.log(error); throw new Error(error);});;
			});
			return Promise.all(promises).catch(error => {console.log("Problem processing legacy files");console.log(error); throw new Error(error);});
		}).catch(error => {console.log("problem processing metadata");console.log(error); throw new Error(error);});
	}).catch(error => {console.log("problem getting directory content");console.log(error); throw new Error(error);});
};








	/*	
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	const listDirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	let dirs = listFiles(dir);
	console.log("files = "); console.log(files);
	console.log("dirs = "); console.log(dirs);
	*/
	//const listSubElements = p => fs.readdirSync(p);
	//let subElements = listSubElements(dir);

	//let subElements = fs.readdirSync(dir);
	//console.log("subElements = "); console.log(subElements);
	

	//only interested in vector file types
	/*
	files = files.filter(file => {
		const ft = file.split('.')[file.split('.').length-1].toUpperCase();
		return (ft === "SHP"); //TODO: other file types?
	});
	*/

	/*
	//First process metadata, keeping track of filename-ID mapping
	return require("./metadata").upload(dir, "geodata", collectionID, db)
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

			try {
				const isDir = fs.statSync(path.join(dir, element)).isDirectory();
				console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!isDir = " + isDir);
			} catch (e) {
				console.log("!!!!!!!!!!!!!!!!!!!!!!Well that didn't work");console.log(e);
			}

			const util = require('util');
			const statAsync = util.promisify(fs.stat);
			statAsync(path.join(dir,element)).then(stats => {
				if (err) {
					console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!");console.log(err);
				} else {
					console.log("!!!!!!!!!!!!!async is dir = " + stats.isDirectory());
				}
			});

			if (fs.statSync(element).isDirectory()) {
				console.log("processing legacy directory " + element);
				return Promise.resolve();
			} else {
				console.log("processing legacy file " + element);

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

				//Use gdal to get extent and srs (from first layer)
				const gdal = require("gdal");
				const dataset = gdal.open(dir + "/" + file);
				const layer = dataset.layers.get(0);
				const extent = layer.getExtent();
				const srs = (layer.srs ? layer.srs.toProj4() : 'null');

				try {
				console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
				const file2 = "stuff.dbf";
				const dataset2 = gdal.open(dir + "/" + file2);
				const layer2 = dataset2.layers.get(0);
				const extent2 = layer2.getExtent();
				const srs2 = (layer2.srs ? layer2.srs.toProj4() : 'null');
				console.log("file = " + file2);
				console.log("extent = ");console.log(extent2);
				console.log("srs = " + srs2);
				console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
				} catch (error) {
					console.log(error);
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
									"'" + dir + "/" + file + "'," +
									"ST_MakeEnvelope(" + extent.minX + "," + extent.minY + "," + extent.maxX + "," + extent.maxY + "," + srid + ")" +
					")").catch(error => {console.log("problem inserting legacy record:");console.log(error); throw new Error(error);});
				}).catch(error => {console.log("problem obtaining srid:");console.log(error); throw new Error(error);});
			}		
		});
		return Promise.all(promises).catch(error => {console.log("Problem processing legacy files");console.log(error); throw new Error(error);});
	});

};
*/
