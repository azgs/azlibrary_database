exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	console.log("processing raster gisdata");

	//const srid = 4326;

	const path = require('path');

	const myDir = "raster";
	const dir = path.join(rootDir, intermediateDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No raster directory found");
		return Promise.resolve();
	}

	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	console.log("files = "); console.log(files);

	//only interested in raster file types
	files = files.filter(file => {
		const ft = file.split('.')[file.split('.').length-1].toUpperCase();
		return global.rasterTypes.includes(ft);
	});


	//First process metadata, keeping track of filename-ID mapping
	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "gisdata", collectionID, db)
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
			if (metadataID === null) {
				console.log("WARNING: No metadata file found for raster file " + file);
			}

			const gdal = require("gdal");
			const dataset = gdal.open(dir + "/" + file);
			const srs = (dataset.srs ? dataset.srs.toProj4() : 'null');
			const tileSize = dataset.rasterSize.x/10 + "x" + dataset.rasterSize.y/10;
			/*
			console.log("##################################################################");
			console.log("number of bands: " + dataset.bands.count());
			console.log("width: " + dataset.rasterSize.x);
			console.log("height: " + dataset.rasterSize.y);
			console.log("geotransform: " + dataset.geoTransform);
			console.log("srs: " + (dataset.srs ? dataset.srs.toWKT() : 'null'));
			console.log("srs: " + (dataset.srs ? dataset.srs.toProj4() : 'null'));
			console.log("##################################################################");
			*/

			const util = require('util');
			const exec = util.promisify(require('child_process').exec);
		
			return db.oneOrNone("select srid from public.spatial_ref_sys where trim(proj4text) = trim('" + srs + "')")
			.then((data) => {
				const srid = (data === null ? null : data.srid);
				console.log("srid = " + srid);

				return db.tx(t => { //do insert-update inside a transaction

					//return exec('raster2pgsql -s ' + srid + ' -I -C -M "' + dir + '/' + 'nasa_test_raster.tiff" -a gisdata.rasters -f raster')
					return exec('raster2pgsql -I -C -M "' + dir + '/' + file + '" -a gisdata.rasters -f raster -t ' + tileSize)
					.catch((stderr) => {
						console.log("Problem importing raster"); console.log(stderr);
						throw new Error(stderr);
					})
					.then((stdout) => {
						//console.log(stdout);
					
						//A little cleaning on the sql we got from raster2pgsql so that we can run it in a transaction with the update below
						const insert = t.multi(stdout.stdout.replace("VACUUM", "--VACUUM").replace("BEGIN;", "").replace("END;","")).catch(err => {console.log("oh no!");console.log(err);});

						const update = t.none("update gisdata.rasters set " +
							"collection_id = " + collectionID + 
							", metadata_id = " + metadataID + 
							", srid = " + srid +
							", tile_size = '" + tileSize + "'" +
							" where collection_id is null").catch(error => {console.log(error); throw new Error(error);});
						return t.batch([insert, update]);
					});
				}).catch(error => {console.log(error);throw new Error(error);}); 
			}).catch(error => {console.log(error);throw new Error(error);});

		});
		return Promise.all(promises).catch(error => {console.log(error); throw new Error(error);});
	});
};
