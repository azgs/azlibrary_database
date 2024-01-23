const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, collectionID, db) => {
	logger.debug("enter");

	//const srid = 4326;

	//const path = require('path');

	const myDir = "raster";
	const dir = path.join(rootDir, intermediateDir, myDir);

	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No raster directory found");
		return Promise.resolve();
	}

	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	let files = listFiles(dir);
	logger.silly("files = " + global.pp(files));

	//only interested in raster file types
	files = files.filter(file => {
		const ft = file.split('.')[file.split('.').length-1].toUpperCase();
		return global.rasterTypes.includes(ft);
	});


	//First process metadata, keeping track of filename-ID mapping
	return require("./metadata").upload(rootDir, path.relative(rootDir, dir), "gisdata", collectionID, db)
	.then((metadataIDs) => {
	
		metadataIDs = metadataIDs ? metadataIDs : []; //TODO: modify metadata.js to always return an array

		//strip away prefix and filetype from metadata ID mappings. Only interested in name
		metadataIDs = metadataIDs.map(mID => {
			mID.file = mID.file.substring(mID.file.indexOf('-')+1, mID.file.lastIndexOf('.'));
			return mID;
		});

		//Process each raster file
		const promises = files.map((file) => {
			logger.silly("processing raster file " + file);

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
				logger.warn("No metadata file found for raster file " + file);
			}

			const gdal = require("gdal-async");
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
			.catch(error => {
				logger.error("Problem getting srid: " + global.pp(error));
				return Promise.reject(error);
			})			
			.then((data) => {
				const srid = (data === null ? 0 : data.srid);
				logger.silly("srid = " + srid);


				const tmp = require("tmp-promise");
				const { spawn } = require('child_process');
				//const p = spawn('raster2pgsql', [ '-I', '-C', '-M', path.join(dir, file), '-a', 'gisdata.rasters', '-f', 'raster', '-t', tileSize]);		
				const p = spawn('raster2pgsql', [ '-M', path.join(dir, file), '-a', 'gisdata.rasters', '-f', 'raster', '-t', tileSize, '-s', srid]);		
				return tmp.file({keep:false})
				.catch(error => {
					logger.error("Problem creating tmp file: " + global.pp(error));
					return Promise.reject(error);
				})
				.then(outFile => {
					//Put the stuff from raster2pgsql into outFile, tweaking stuff along the way
					return new Promise((resolve, reject) => {  
						logger.silly("path = " + outFile.path);
						const outStream = fs.createWriteStream(outFile.path);
						const split = require("split");
					  	p.stdout.pipe(split())
						.on('data', line => {
							//Clean up stuff we don't want to do inside a transaction
							line = line.replace(/^BEGIN;$/, "");
							line = line.replace(/^END;$/, "");
							line = line.replace(/^VACUUM ANALYZE.*$/, "");
							//Add collection_id to each insert
							let t=0;   
							line = line.replace(/\(/g, match => {
								t++;
								return (t === 1) ? 
									'("collection_id",' : 
									(t === 2) ?
										'(' + collectionID + ',' :
										match;
							});
							outStream.write(line + "\n");
						})
						.on('end', () => {
							logger.silly("stream end");
							resolve();
						})
						.on('error', () => {
							reject();
						}).resume();
					}).then(() => {
						//File is now a bunch of inserts. Run it through pg-promise
						const QueryFile = require('pg-promise').QueryFile;
						const rastSQLFile =  new QueryFile(outFile.path);
						return db.any(rastSQLFile)
						.catch((err) => {
							logger.error("Problem importing raster from tmp file"); logger.error(stderr);
							return Promise.reject(err);
						});
					});
				});	
			}).catch(error => {
				logger.error("Problem processing raster " + file + ": " + global.pp(error));
				return Promise.reject(error);
			});

		});
		return Promise.all(promises).catch(error => {
			logger.error("Failed to process all rasters: " + global.pp(error)); 
			return Promise.reject(error);
		});
	});
};
