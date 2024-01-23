const path = require("path");
const logger = require("./logger")(path.basename(__filename));
const fs = require('fs-extra');

extractGems = (dir, schemaName) => {
	//extracts the gems zip, returning a promise that resolves with the extract dir path
	logger.silly("extractGems enter");
	//find the zip file...
	const listZips = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory() && /\.zip$/i.test(f));
	let zips = listZips(path.join(dir, schemaName));
	logger.silly("zips = " + global.pp(zips));

	if (zips.length === 0) {
		return Promise.reject("No zip found for " + schemaName);
	} else if (zips.length > 1) {
		return Promise.reject("Only one zip allowed for " + schemaName);
	} 

	//...extract it...
	const extractDir = path.join(dir, schemaName, zips[0].slice(0, -4));
	logger.silly("extractDir = " + extractDir);
	return new Promise((resolve, reject) => {
		const StreamZip = require('node-stream-zip');
		const zip = new StreamZip({
			file: path.join(dir, schemaName, zips[0]),
			storeEntries: true
		});

		zip.on('error', () => {return reject();});
		zip.on('ready', () => {
			fs.ensureDir(extractDir);
			zip.extract(null, extractDir, (err, count) => {
				logger.silly(err ? 'Extract error:' + global.pp(err) : `Extracted ${count} entries`);
				zip.close();
				logger.silly("resolving");
				return resolve();
			});
		});
	}).then(() => {
		logger.silly("extract success");
		//...find root dir of gems data...
		const subs = fs.readdirSync(extractDir);
		const gemsDir = subs.length === 1 ?
			path.join(extractDir, subs[0]) :
			extractDir;
		//...resolve with path to the encapsulated gems data
		return Promise.resolve(gemsDir);
	}).catch(error => {
		logger.error(global.pp(error));
		throw error;
	});
}

exports.upload = (dir, schemaName, collection, db) => {
	logger.debug("enter with schemaName = " + schemaName);

	//First, verify that schema exists
	return db.one(`
		select 
			schema_name 
		from 
			information_schema.schemata 
		where 
			schema_name = '${schemaName}'
	`)
	.catch(error => {console.log("Schema " + schemaName + " does not exist.");return Promise.reject(error);})
	.then(() => {
		const listGDBs = p => fs.readdirSync(p).filter(f => (!fs.statSync(path.join(p, f)).isDirectory() && /\.gdb\.zip$/i.test(f)) ||
															(fs.statSync(path.join(p, f)).isDirectory() && /\.gdb$/i.test(f)));
		let gdbs = listGDBs(path.join(dir, schemaName));
		if ("ncgmp09" === schemaName && gdbs.length > 0) {
			//schema import is old-format ncgmp09
			logger.silly("schema import is old-format ncgmp09");
			//resolve with path to the data directory
			return Promise.resolve(path.join(dir, schemaName));
		} else {
			//schema import format is gems
			logger.silly("schema import format is gems");
			//resolve with path extracted from gems zip
			return extractGems(dir, schemaName);
		}
	}).then((dir) => {
		logger.silly("dir = " + dir);

		//Next, check for gdb directory
		const listGDBs = p => fs.readdirSync(p).filter(f => (!fs.statSync(path.join(p, f)).isDirectory() && /\.gdb\.zip$/i.test(f)) ||
															(fs.statSync(path.join(p, f)).isDirectory() && /\.gdb$/i.test(f)));
		let gdbs = listGDBs(dir);
		logger.silly("gdbs = " + global.pp(gdbs));

		if (gdbs.length === 0) {
			return Promise.reject("No gdb directory found");
		} else if (gdbs.length > 1) {
			return Promise.reject("Only one gdb directory allowed");
		} 

		//get list of layers in gdb
		const gdal = require("gdal-async");
		logger.silly(path.join(dir, gdbs[0]));
		const dataset = gdal.open(path.join(dir, gdbs[0]));
		const gdbLayers = dataset.layers.map((layer) => {
			return layer.name;
		});

		//ogr2ogr works outside of the current db transaction. This causes problems in the event of
		//and error and db rollback. So, we let it upload into a temporary schema. Then we copy 
		//the content of that schema using the transaction.
		const tmpSchema = collection.permID.replace(/-/g, '_').toLowerCase();

		//Fetch list of existing tables. These are the only layers we will want from the gdb.
		//return db.any("select table_name from information_schema.tables where table_schema='" +  schemaName + "'")	
		return db.any(`select name, required from ${schemaName}.layers`)	
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

			const ogr2ogr = require('ogr2ogr');

			const util = require('util');
			const exec = util.promisify(require('child_process').exec);
			
			//azlibConfigGDB creates the temporary schema. It also works outside of the overall db
			//transaction. We pass a -c option here to tell it to create the schema but not load it.
			//This allows us to trap possible schema errors in the incoming collection. Prior to this,
			//ogr2ogr just kinda rolled with it.
			const execStr = 'azlibConfigGDB -l silly -c -g ' + tmpSchema + 
				' -d ' +  args.dbname + 
				' -u ' + args.username + 
				' -p ' + args.password + 
				" -h " + args.host +
                		" -o " + args.port +
                		(args.cert ? " -s " + args.cert : "");
			logger.silly(execStr);

			return exec(execStr)
			.then((stdio) => {
				logger.silly("in ogr then");
				logger.silly(args);
				logger.silly("output from azlibConfigGDB: " + global.pp(stdio));

				const ogrPromise = new Promise((resolve, reject) => {
					ogr2ogr(dir + "/" + gdbs[0])
					.format('PostgreSQL')
					.project('EPSG:4326')
					.timeout(50000)
					.options(layers.concat(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO']))
					.destination(
						'PG:host=' + args.host +
						' port=' +  args.port +
						' user=' + args.username + 
						' password=' + args.password +
						' sslmode=verify-ca' +
						' sslrootcert=' + args.cert + 
						' dbname=' + args.dbname +
						' active_schema=' + tmpSchema + 
						' schemas=' + tmpSchema)
					.exec(function(error, data) {
						if (error) {
							logger.error(">>>>>ogr fail<<<<<");
							reject(error);
						} else {
							logger.silly("ogr success");
							resolve(layers);
						}
					});
				});
				return ogrPromise.catch(error => {logger.error(error);throw new Error(error);});
			}).catch((error) => {
				logger.error("Failed to create and populate temp schema: " + global.pp(error));
				return Promise.reject(error);
			});

		}).then ((layers) => {
			logger.silly("In post-ogr then, layers = " + global.pp(layers));
			//Add collection_id column to each table, set to the current collectionID.
			const cidPromises = layers.map((layer) => {
				return db.none(`					
					alter table ${tmpSchema}."${layer}"
					add column collection_id integer not null default ${collection.collectionID}
				`)
				.then(() => {
					logger.debug("successfully added collection_id for " + layer);
				})
				.catch(error => {throw new Error(error);});
			});
			return Promise.all(cidPromises).catch(error => {throw new Error(error);}).then(() => {return Promise.resolve(layers)});
		}).then ((layers) => {
			logger.silly("In copy section, layers = " + global.pp(layers));
			
			const copyPromises = layers.map((layer) => {
				logger.silly("copying " + layer);

				//Get list of column names in destination schema. This is a bit of postgres-fu.
				return db.any(`
					SELECT 
						c.column_name
					FROM 
						information_schema.columns AS c
					WHERE 
						table_schema = '${schemaName}' AND 
						table_name = '${layer}' AND  
						c.column_name NOT IN('OBJECTID', 'feature_id')
				`)
				.catch((error) => {logger.error(global.pp(error)); throw error;})
				.then((result) => {
					logger.silly("column query result = " + global.pp(result));

					//Build a string from the columns
					const columns = result.reduce((acc, column, idx) => {
						if (idx === result.length-1) {
							return acc + '"' + column.column_name + '"';
						} else {
							return acc + '"' + column.column_name + '",';
						}
					},'');
					logger.silly("columns = " + global.pp(columns));

					//Then use that string to copy the columns we need (all but OBJECTID) into the destination table
					//Note: This will blow up if there is a mismatch between the source and destination columns.
					//That's ok.
					return db.none(`
						insert into ${schemaName}."${layer}"
							(${columns})
							select ${columns} from ${tmpSchema}."${layer}"
					`).catch(error => {
						logger.error("Aw man, can't copy. Error: " + global.pp(error)); 
						return Promise.reject(error);
					});
				});
			});
			return Promise.all(copyPromises)
			.catch(error => {
				logger.error("Problem copying schema: " + global.pp(error));
				return Promise.reject(error);
			}).then(() => {return Promise.resolve()});
		}).then ((layers) => {
			logger.silly("In drop section");
			return db.none(`drop schema if exists "${tmpSchema}" cascade`);
			//return Promise.resolve();//for testing
		});

	}).catch(error => {
		logger.error("Problem processing gdb: " + global.pp(error));
		return Promise.reject(error);
	}).then(() => {
		return require("./metadata").upload(dir, "gisdata", collection.collectionID, db);
	});

};
