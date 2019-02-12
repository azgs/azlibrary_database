const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (dir, schemaName, collectionID, db) => {
	logger.debug("enter with schemaName = " + schemaName);

	//First, verify that schema exists
	return db.one("select schema_name from information_schema.schemata where schema_name = '" + schemaName + "';")
	.catch(error => {console.log("Schema " + schemaName + " does not exist.");return Promise.reject(error);})
	.then(() => {

		//Next, check for gdb directory
		dir = dir + "/" + schemaName;
		const fs = require('fs');
		const path = require('path');
		const listDirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory() || /\.zip$/i.test(f));
		let dirs = listDirs(dir);
		logger.silly("dirs before filter = " + global.pp(dirs));
		dirs = dirs.filter(file => /\.gdb$/i.test(file) ||/\.gdb\.zip$/i.test(file)); 
		logger.silly("dirs = " + global.pp(dirs));

		if (dirs.length === 0) {
			return Promise.reject("No gdb directory found");
		} else if (dirs.length > 1) {
			return Promise.reject("Only one gdb directory allowed");
		} 

		//get list of layers in gdb
		const gdal = require("gdal");
		logger.silly(path.join(dir, dirs[0]));
		const dataset = gdal.open(path.join(dir, dirs[0]));
		const gdbLayers = dataset.layers.map((layer) => {
			return layer.name;
		});

		//Fetch list of existing tables. These are the only layers we will want from the gdb.
		//return db.any("select table_name from information_schema.tables where table_schema='" +  schemaName + "'")	
		return db.any("select name, required from " + schemaName + ".layers")	
		.then(tables => {

			//create list of required layers
			const requiredLayers = tables.reduce((acc, table) => {
				if (table.required) { 
					acc.push(table.name);
				}
				return acc;
			}, []);
			logger.silly("requiredLayers = " + global.pp(requiredLayers));

			//create list of gdb layers we want
			const layers = tables.reduce((acc, table) => {
				if (gdbLayers.includes(table.name)) { 
					acc.push(table.name);
				}
				return acc;
			}, []);
			logger.silly("layers = " + global.pp(layers));

			//verify that required layers are present
			const missingRequiredLayers = requiredLayers.reduce((acc, r) => {
				if (!layers.includes(r)) { 
					acc.push(r);
				}
				return acc;
			}, []);
			if (missingRequiredLayers.length > 0) return Promise.reject("GDB is missing required layers: " + missingRequiredLayers);

			//create list of layers with schema name
			const qualifiedLayers = layers.map((layer) => {
				return schemaName + '."' + layer + '"';
			});

			//**************tmp testing
			try {
				logger.silly("running gdal");
				const gdal = require("gdal");
				const dataset = gdal.open(dir + "/" + dirs[0]); logger.silly("dataset = " + global.pp(dataset));
				//logger.silly("dataset layers = " + global.pp(dataset.layers.DatasetLayers));
				//const extent1 = dataset.getProjectionRef(); logger.silly("projRef = " + global.pp(extent1));
				dataset.layers.forEach((layer, i) => {
					logger.silly("layer " + i + " = " + global.pp(layer));
					try {
						extent = layer.getExtent(); logger.silly("extent = " + global.pp(extent));
						extent.srid = (layer.srs ? layer.srs.toProj4() : 'null'); logger.silly("layer.srs = " + layer.srs);
						logger.silly("srid = " + extent.srid);
					} catch (err) {
						logger.warn("Unable to get extent from layer ");
					}
				});				
				
				//const layer = dataset.layers.get(14); logger.silly("layer = " + global.pp(layer));
				//extent = layer.getExtent(); logger.silly("extent = " + global.pp(extent));
				//extent.srid = (layer.srs ? layer.srs.toProj4() : 'null'); logger.silly("layer.srs = " + layer.srs);
				//logger.silly("srid = " + extent.srid);
			} catch (err) {
				logger.warn("Problem with gdal for " + dir + "/" + dirs[0] + ": " + global.pp(err));
			}

			//*****************************

			const ogr2ogr = require('ogr2ogr');

			//append new gdb to existing gdb (fetching only the layers we want)
			const ogrPromise = new Promise((resolve, reject) => {
				ogr2ogr(dir + "/" + dirs[0])
				.format('PostgreSQL')
				//.project('EPSG:4326')
				.timeout(50000)
				.options(layers.concat(['-t_srs', 'EPSG:4326', '-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-append']))
				.destination('PG:host=localhost user=' + args.username + ' password=' + args.password + ' dbname=' + args.dbname + ' schemas=' + schemaName)
				.exec(function(error, data) {
					if (error) {
						reject(error);
					} else {
						resolve(qualifiedLayers);
					}
				});
			});
			return ogrPromise.catch(error => {logger.error(error);throw new Error(error);});

		}).then ((layers) => {
			//Set collection_id in each record that has a null
			//TODO: This approach is a little janky
			const cidPromises = layers.map((layer) => {
				//console.log("layer = " + layer);
				return db.none("update " + layer + 
					" set collection_id = " + collectionID +
					" where collection_id is null")
				.then(() => {
					logger.debug("successfully updated collection_id for " + layer);
				})
				.catch(error => {throw new Error(error);});
			});
			return Promise.all(cidPromises).catch(error => {throw new Error(error);});
		});

	}).catch(error => {logger.error("Problem processing gdb: " + global.pp(error));return Promise.reject(error);})
	.then(() => {
		return require("./metadata").upload(dir, "gisdata", collectionID, db);
	});

};
