const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.upload = (rootDir, intermediateDir, schemaName, collectionID, db) => {
	logger.debug("enter");

	logger.debug("inter dir = " + intermediateDir);
	const myDir = "metadata";

	const path = require('path');
	const dir = path.join(rootDir, intermediateDir, myDir);

	//Verify that directory exists
	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		logger.warn("No metadata directory found");
		return Promise.resolve();
	}

	const idReturn = [];

	//const fs = require('fs');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	const files = listFiles(dir);
	logger.silly("files = " + global.pp(files));

	//Process each file
	const promises = files.map((file) => {
		const type = file.split('.')[0].split('-')[0].toUpperCase();
		logger.silly("metadata type = " + type);

		//If type is not recognized, ignore file
		if (!global.metadataTypes.includes(type)) {
			logger.warn("Invalid metadata type: " + type);
			return Promise.resolve();
		}

		logger.silly("file = " + file);
		if (file.split('.')[file.split('.').length-1].toUpperCase() === "XML") {
			logger.silly("processing xml metadata for " + file);

			//read xml file
			const xmlPath = path.resolve(dir, file);//process.cwd() + "/" + dir + "/" + file;

			const util = require("util");

			const readFilePromise = util.promisify(fs.readFile);
			return readFilePromise(xmlPath, 'utf-8')
			.catch(error => {logger.warn("no xml data in " + file + ": " + error);return Promise.reject(error);})
			.then((data) => {      
				logger.silly("processing xml content for " + file);

				const xml2js = util.promisify(require('xml2js').parseString);
				return xml2js(data).catch(error => {logger.warn("Problem parsing xml in " + file + ": " + error); return Promise.reject(error);})
			}).then((data) => {
				logger.silly("json from metadata in " + file + " = " + global.pp(data));

				let metadataInsert, collectionsUpdate; 

				//If not top level metadata file					
				if (intermediateDir) {
					metadataInsert = 
						"insert into " + schemaName + ".metadata (collection_id, type, json_data, metadata_file) values (" +
						collectionID + ", $$" + 
						type + "$$, $$" + 
						JSON.stringify(data) + "$$, $$" +
						path.join(intermediateDir, myDir, file) + "$$) returning metadata_id";
				} else {
					//TODO: I don't like that these are hardcoded. Maybe put in metadata.types?
					if ("ISO19115" === type.toUpperCase() || "ISO19139" === type.toUpperCase()) {

						//We need to update collections with the proper formal_name. Get that statement ready.
						/*			
						This was a cool way to do it, using postgres' json query ability, but not 
						necessary, since we already have the object in memory. 			
						collectionsUpdate = ` 						
							update collections set formal_name =  (
								select 
									json_data->
										'gmd:MD_Metadata'->
											'gmd:identificationInfo'->0->
												'gmd:MD_DataIdentification'->0->
													'gmd:citation'->0->
														'gmd:CI_Citation'->0->
															'gmd:title'->0->
																'gco:CharacterString'->>0
								from metadata.metadata where collection_id = ${collectionID}
							)
							where collection_id = ${collectionID}					
						`;
						*/

						const title = data['gmd:MD_Metadata']
										['gmd:identificationInfo'][0]
										['gmd:MD_DataIdentification'][0]
										['gmd:citation'][0]['gmd:CI_Citation'][0]
										['gmd:title'][0]['gco:CharacterString'][0];
						logger.silly("title = " + title);
						collectionsUpdate = "update collections set formal_name = $$" + title + "$$ where collection_id = " + collectionID;
						
						//xml files should map and use the gmd prefix. But sometimes they don't. 
						//This should allow us to handle either case.
						let prefix = "";
						try {
							//prefix = data['gmd:MD_Metadata']['$'['xmlns:gmd']] ? data['gmd:MD_Metadata']['$']['xmlns:gmd'] + ":" : "";
							logger.silly("gmd mapping = " + data['gmd:MD_Metadata']['$']['xmlns:gmd']);						
							prefix = data['gmd:MD_Metadata']['$']['xmlns:gmd'] ? "gmd:" : "";
						} catch (error) {logger.warn("gmd prefix not properly defined in xml file " + file);}
						logger.silly("prefix = " + prefix);

						const minX = data[prefix + 'MD_Metadata'][prefix + 'identificationInfo'][0][prefix + 'MD_DataIdentification'][0][prefix + 'extent'][0][prefix + 'EX_Extent'][0][prefix + 'geographicElement'][0][prefix + 'EX_GeographicBoundingBox'][0][prefix + 'westBoundLongitude'][0]['gco:Decimal'][0];
						const maxX = data[prefix + 'MD_Metadata'][prefix + 'identificationInfo'][0][prefix + 'MD_DataIdentification'][0][prefix + 'extent'][0][prefix + 'EX_Extent'][0][prefix + 'geographicElement'][0][prefix + 'EX_GeographicBoundingBox'][0][prefix + 'eastBoundLongitude'][0]['gco:Decimal'][0];
						const minY = data[prefix + 'MD_Metadata'][prefix + 'identificationInfo'][0][prefix + 'MD_DataIdentification'][0][prefix + 'extent'][0][prefix + 'EX_Extent'][0][prefix + 'geographicElement'][0][prefix + 'EX_GeographicBoundingBox'][0][prefix + 'southBoundLatitude'][0]['gco:Decimal'][0];
						const maxY = data[prefix + 'MD_Metadata'][prefix + 'identificationInfo'][0][prefix + 'MD_DataIdentification'][0][prefix + 'extent'][0][prefix + 'EX_Extent'][0][prefix + 'geographicElement'][0][prefix + 'EX_GeographicBoundingBox'][0][prefix + 'northBoundLatitude'][0]['gco:Decimal'][0];
						logger.silly("bbox = " + minX + ", " + minY + ", " + maxX + ", " + maxY);
						metadataInsert = 
							"insert into " + schemaName + ".metadata (collection_id, type, json_data, metadata_file, geom) values (" +
							collectionID + ", $$" + 
							type + "$$, $$" + 
							JSON.stringify(data) + "$$, $$" +
							path.join(intermediateDir, myDir, file) + "$$, " +
							"ST_MakeEnvelope(" + minX + "," + minY + "," + maxX + "," + maxY + ",4326)) returning metadata_id";
					} else {
						logger.error("Unrecognize top-level xml format. Can't create insert statement.");
					}
				}
				logger.silly("insert for " + file + " = " + metadataInsert);

				return db.one(metadataInsert)
				.catch(error => {
					logger.error("Problem inserting metadata record: " + global.pp(error));
					return Promise.reject(error);
				})
				.then((data) => {
					idReturn.push({file: file, metadataID: data.metadata_id});
					//Update formal_name in collections from the json metadata
					if (collectionsUpdate) {
						logger.silly("Top level metadata, so updating collections");
						return db.none(collectionsUpdate).catch(error => {
							logger.error("Problem updating formal_name in collections: " + global.pp(error));
							return Promise.reject(error);
						});
					} else { //not a top level metadata file; don't update collections
						logger.silly("Not top level metadata, so not updating collections");
						return Promise.resolve();
					}
				})
			});

		} else { //not an xml file
			return Promise.resolve(); //No need to reject. Basically just ignore file
		}
	});
	return Promise.all(promises)
	.catch(error => {
		logger.error("Problem processing metadata for " + schemaName + ": " + global.pp(error)); 
		return Promise.reject(error);
	}).then(() => Promise.resolve(idReturn));
}



