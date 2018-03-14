exports.upload = (dir, schemaName, collectionID, db, dbName, user, password) => {
	console.log("processing gdb");

	//First, verify that schema exists
	return db.one("select schema_name from information_schema.schemata where schema_name = '" + schemaName + "';")
	.catch(error => {console.log("Schema " + schemaName + " does not exist.");return Promise.reject(error);})
	.then(() => {

		//Next, check for gdb directory
		dir = dir + "/" + schemaName;
		const fs = require('fs');
		const path = require('path');
		const listDirs = p => fs.readdirSync(p).filter(f => fs.statSync(path.join(p, f)).isDirectory());
		let dirs = listDirs(dir);
		dirs = dirs.filter(file => file.split('.')[file.split('.').length-1].toUpperCase() === "GDB"); 
		console.log("dirs = ");console.log(dirs);

		if (dir.length === 0) {
			return Promise.reject("No gdb directory found");
		} else if (dirs.length > 1) {
			return Promise.reject("Only one gdb directory allowed");
		} 

		//Process gdb directory
		let existingTables;
		//Create list of layers in new gdb
		const gdal = require("gdal");
		console.log(process.cwd() + "/" + dir + "/" + dirs[0]);
		const dataset = gdal.open(process.cwd() + "/" + dir + "/" + dirs[0]);
		const layers = dataset.layers.map((layer, i) => {
			return schemaName + '."' + layer.name + '"';
		});

		//Create list of existing tables for comparison to new gdb content
		return db.any("select table_name from information_schema.tables where table_schema='" +  schemaName + "'")	
		.then(tables => {

			existingTables = tables.map((table, i) => {
				return schemaName + '."' + table.table_name + '"';
			});
			//console.log("existing tables"); console.log(existingTables);

			const ogr2ogr = require('ogr2ogr');

			//append new gdb to existing gdb
			const ogrPromise = new Promise((resolve, reject) => {
				ogr2ogr(dir + "/" + dirs[0])
				.format('PostgreSQL')
				.options(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-append'])
				.destination('PG:host=localhost user=' + user + ' password=' + password + ' dbname=' + dbName + ' schemas=' + schemaName)
				.exec(function(error, data) {
					if (error) {
						reject(error);
					} else {
						resolve(data);
					}
				});
			});
			return ogrPromise.catch(error => {throw new Error(error);});
		}).then(() => {

			//find any new tables brought in with this gdb
			const newTables = layers.reduce((acc, layer) => {
				if (!existingTables.includes(layer)) {
					acc.push(layer);
				}
				return acc;
			}, []);
			console.log("new tables"); console.log(newTables);

			//add collection_id column to each new table
			const newTablePromises = newTables.map(table => {
				//console.log(table);
				return db.none('alter table ' + table + ' add column collection_id integer references public.collections (collection_id)')
				.then(() => {
					console.log("successfully added collection_id to " + table)
				})
				.catch(error => {throw new Error(error);});
			});               
			return Promise.all(newTablePromises).catch(error => {throw new Error(error);});
		}).then (() => {
			//Set collection_id in each record that has a null
			//TODO: This approach is a little janky
			const cidPromises = layers.map((layer, i) => {
				//console.log("layer = " + layer);
				return db.none("update " + layer + 
					" set collection_id = " + collectionID +
					" where collection_id is null")
				.then(() => {
					console.log("successfully updated collection_id for " + layer);
				})
				.catch(error => {throw new Error(error);});
			});
			return Promise.all(cidPromises).catch(error => {throw new Error(error);});
		});

	}).catch(error => {console.log(error);return Promise.reject(error);})
	.then(() => {
		return require("./metadata").upload(dir, "geodata", collectionID, db);
	});



	


};
