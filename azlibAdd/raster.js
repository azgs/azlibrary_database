exports.upload = (dir, collectionID, db) => {
	console.log("processing legacy geodata");

	const srid = 4326;

	dir = dir + "/raster";

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No raster directory found");
		return Promise.resolve();
	}

	/*
	const gdal = require("gdal");
	const dataset = gdal.open(dir + "/" + "nasa_test_raster.tiff");
	console.log("##################################################################");
	console.log("number of bands: " + dataset.bands.count());
	console.log("width: " + dataset.rasterSize.x);
	console.log("height: " + dataset.rasterSize.y);
	console.log("geotransform: " + dataset.geoTransform);
	console.log("srs: " + (dataset.srs ? dataset.srs.toWKT() : 'null'));
	console.log("##################################################################");
	*/


	const path = require('path');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	console.log("files = "); console.log(files);

	//only interested in raster file types
	files = files.filter(file => {
		const ft = file.split('.')[file.split('.').length-1].toUpperCase();
		return (ft === "TIFF" || ft === "TIF"); //TODO: other raster types here
	});


	//First process metadata, keeping track of filename-ID mapping
	return require("./metadata").upload(dir, "geodata", collectionID, db)
	.then((metadataIDs) => {
	
		//strip away prefix and filetype from metadata ID mappings. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		//Process each raster file
		const promises = files.map((file) => {
			console.log("processing raster file " + file);

			//Find metadata id that corresponds to this file
			let metadataID = metadataIDs.reduce((id, mID) => {
				if (mID.file === file.substring(0, file.lastIndexOf('.'))) {
					return mID.metadataID;
				} else {
					return id;
				}
			}, null);
			console.log("metadataID = " + metadataID);

			const util = require('util');
			const exec = util.promisify(require('child_process').exec);
			
			return db.tx(t => { //do insert-update inside a transaction

				return exec('raster2pgsql -s ' + srid + ' -I -C -M "' + dir + '/' + 'nasa_test_raster.tiff" -a geodata.rasters -f raster')
				.catch((stderr) => {
					console.log("uhoh"); console.log(stderr);
				})
				.then((stdout) => {
					console.log(stdout);
					
					const insert = t.multi(stdout.stdout.replace("VACUUM", "--VACUUM").replace("BEGIN;", "").replace("END;","")).catch(err => {console.log("oh no!");console.log(err);});
					//TODO: srid
					const update = t.none("update geodata.rasters set " +
						"collection_id = " + collectionID + 
						", metadata_id = " + metadataID + 
						", srid = " + srid +
						" where collection_id is null").catch(error => {console.log(error); throw new Error(error);});
					return t.batch([insert, update]);
				});
			}).catch(error => {console.log(error);throw new Error(error);}); 

		});
		return Promise.all(promises).catch(error => {console.log(error); throw new Error(error);});
	});
};
