exports.upload = (dir, schemaName, collectionID, db) => {
	console.log("processing gdb");

	let layerFilterFunction = () => {return false;};
	let schemaSpecialProcessingPromise = () => {return Promise.resolve();};
	if (schemaName.toLowerCase() === "ncgmp09") {
		layerFilterFunction = ncgmp09LayerFilterFunction;
		schemaSpecialProcessingPromise = ncgmp09SpecialProcessingPromise;
	}


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

		if (dirs.length === 0) {
			return Promise.reject("No gdb directory found");
		} else if (dirs.length > 1) {
			return Promise.reject("Only one gdb directory allowed");
		} 

		//Process gdb directory
		let existingTables;
		let newTables;
		//Create list of layers in new gdb
		const gdal = require("gdal");
		//console.log(process.cwd() + "/" + dir + "/" + dirs[0]);
		console.log(path.join(dir, dirs[0]));
		//const dataset = gdal.open(process.cwd() + "/" + dir + "/" + dirs[0]);
		const dataset = gdal.open(path.join(dir, dirs[0]));
		const layers = dataset.layers.map((layer, i) => {
			return schemaName + '."' + layer.name + '"';
		});

		const specialLayers = layers.filter(layer => {
			return layerFilterFunction(layer.split('.')[1].slice(1))
		});
		console.log("!!!!!!!!!!!!!!!!specialLayers = ");console.log(specialLayers);

		//Create list of existing tables for comparison to new gdb content
		return db.any("select table_name from information_schema.tables where table_schema='" +  schemaName + "'")	
		.then(tables => {

			existingTables = tables.map((table, i) => {
				return schemaName + '."' + table.table_name + '"';
			});
			//console.log("existing tables"); console.log(existingTables);

			//find any new tables brought in with this gdb
			newTables = layers.filter(layer => {
				return(!existingTables.includes(layer) && !specialLayers.includes(layer));
			});
			console.log("new tables"); console.log(newTables);
			
			if (!args.unrecOK && newTables.length > 0) {
				throw new Error("Unrecognized tables detected");
			}

			const ogr2ogr = require('ogr2ogr');

			//append new gdb to existing gdb
			const ogrPromise = new Promise((resolve, reject) => {
				ogr2ogr(dir + "/" + dirs[0])
				.format('PostgreSQL')
				.timeout(50000)
				.options(['-lco', 'GEOMETRY_NAME=geom', '-lco', 'LAUNDER=NO', '-append'])
				.destination('PG:host=localhost user=' + args.username + ' password=' + args.password + ' dbname=' + args.dbname + ' schemas=' + schemaName)
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
			return schemaSpecialProcessingPromise(specialLayers, db, schemaName);
		}).then (() => {
			//Set collection_id in each record that has a null
			//TODO: This approach is a little janky
			const cidPromises = layers.map((layer, i) => {
				//console.log("layer = " + layer);
				if (layer.split('.')[1].startsWith('"CS')) {
					return Promise.resolve();
				}
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
		return require("./metadata").upload(dir, "gisdata", collectionID, db);
	});

};

const ncgmp09LayerFilterFunction = layer => {return layer.toUpperCase().startsWith("CS");}
const ncgmp09SpecialProcessingPromise = (crossSectionLayers, db, schemaName) => {
			//handle each cross section table
			const csPromises = crossSectionLayers.map(layer => {
				//fetch cross section id based on cross section letter (a, b, c...)
				const cs = layer.split('.')[1].substr(1,3);
				console.log(">>>>>>>>>>>>>>>>>>>>>>>cs = " + cs);
				return db.one("select cross_section_id from " + schemaName + ".cross_sections where cross_section_prefix = '" + cs + "'")
				.catch(error => {
					console.log("Problem with cross section " + cs + ":");console.log(error);
					throw new Error(error);
				})				
				.then(data => {
					const id = data.cross_section_id				
					console.log("id = " + id);

					const tableName = "cs_" + layer.split('.')[1].slice(4).split('"')[0].toLowerCase();
					console.log(">>>>>>>>>>>>>>>>>> tableName = " + tableName);
					
					//Verify that we have a cs_ table for this cross section layer				
					return db.one("select table_name from information_schema.tables where table_schema='" +  schemaName + "' and table_name='" + tableName + "'")
					.catch(error => {
						console.log("Unrecognized cross section table.")
						throw new Error("Unrecognized cross section table.");
					})
					/*	
					I dunno, this seems like a pain. So, I'm throwing the error above until somebody says different.		
					return db.oneorNone("select table_name from information_schema.tables where table_schema='" +  schemaName + "' and table_name='" + tableName + "'")
					.then(data => {
						if (data !== null) {
							return Promise.resolve();
						} else {
							return db.none("create table " + tableName + " (like " + layer + " including defaults including constraints including indexes)")
							.then(() => {
								return db.none('alter table ' + layer + ' add column collection_id integer references public.collections (collection_id)')
							})
						}
					})
					*/
					.then(() => {
						//get list of columns in source table	
						const s = "select column_name from information_schema.columns where table_schema = '" + schemaName + "' and table_name = '" + layer.split('.')[1].split('"')[1] + "'"
						console.log(s);
						return db.any(s)
						.then(data => {
							console.log("column name data = ");console.log(data);
							const sourceColumns = data.map(datum => {
								return '"' + datum.column_name + '"';
							});
							//create list of columns in our destination table
							const destColumns = sourceColumns.map(column => {
								if (column.startsWith('"CS')) {
									//console.log("starts with CS "); console.log(column.slice(4));
									return '"' + column.slice(4);
								} else {
									//console.log("does not start with CS");
									return column;
								}
							});
							console.log("sourceColumns = ");console.log(sourceColumns);
							console.log("destColumns = ");console.log(destColumns);
							
							//copy data from source cross section table into our corresponding cs_ table, adding our cross section id.
							const q = "insert into " + schemaName + "." + tableName + "(cross_section_id, " + destColumns.toString() + ") select " + id + ", " + sourceColumns.toString() + " from " + layer;
							console.log("insert = " + q);
							return db.none(q).catch(error => {console.log("Problem copying data");console.log(error);throw new Error(error);});
						})						
						.catch(error => {
							console.log("Problem copying data from cross section table " + layer);
							console.log(error);
							throw new Error(error);
						});
					})	
				}).then(id => {
					return db.none("drop table " + layer)
					.catch(error => {
						console.log("Problem dropping cross section table " + layer);console.log(error);
						throw new Error(error);
					});
				});
			});
			return Promise.all(csPromises).catch(error => {throw new Error(error);});
}


