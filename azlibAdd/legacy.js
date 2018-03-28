exports.upload = (dir, collectionID, db) => {
	console.log("processing legacy geodata");

	dir = dir + "/legacy";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No legacy directory found");
		return Promise.resolve();
	}

	const path = require('path');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	console.log("files = "); console.log(files);

	//only interested in vector file types
	files = files.filter(file => {
		const ft = file.split('.')[file.split('.').length-1].toUpperCase();
		return (ft === "SHP"); //TODO: other file types?
	});


	//First process metadata, keeping track of filename-ID mapping
	return require("./metadata").upload(dir, "geodata", collectionID, db)
	.then((metadataIDs) => {
	
		//strip away prefix and filetype from metadata ID mappings. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		//Process each legacy file
		const promises = files.map((file) => {
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

			//Use gdal to get extent and srs (from first layer)
			const gdal = require("gdal");
			const dataset = gdal.open(dir + "/" + file);
			const layer = dataset.layers.get(0);
			const extent = layer.getExtent();
			const srs = (layer.srs ? layer.srs.toProj4() : 'null');

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
			}).catch(error => {console.log(error); throw new Error(error);});
		});
		return Promise.all(promises).catch(error => {console.log(error); throw new Error(error);});
	});

};
