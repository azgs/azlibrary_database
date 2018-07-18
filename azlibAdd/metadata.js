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
		//console.log("type = " + type);

		logger.silly("file = " + file);
		if (file.split('.')[file.split('.').length-1].toUpperCase() === "XML") {
			return new Promise((resolve, reject) => { 
				logger.silly("processing xml metadata for " + file);

				//read xml file
				const xmlPath = path.resolve(dir, file);//process.cwd() + "/" + dir + "/" + file;
				//let fs = require('fs');

				new Promise((resolve) => {
					logger.silly("reading xml file " + file);
					fs.readFile(xmlPath, 'utf-8', function (error, data){
						if(error) {
							logger.warn(error);
							resolve(null);
						}
						resolve(data);    
					}); 
				}).then((data) => {      
					logger.silly("processing xml content for " + file);
					if (data === null) {
						logger.warn("no xml data");
						resolve();
					}

					const xml2js = require('xml2js').parseString;
					new Promise((resolve, reject) => {
						xml2js(data, function (err, result) {
							if (err) {
								reject(err);
							}
							resolve(result);
						});
					}).then((data) => {
						//console.log("xml data = " + data);
						logger.silly("json from metadata in " + file + " = " + global.pp(data));	
						let metadataInsert; 
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

								//xml files should map and use the gmd prefix. But sometimes they don't. 
								//This should allow us to handle either case.
								const prefix = "";
								try {
									prefix = data['gmd:MD_Metadata']['$'['xmlns:gmd']] ? data['gmd:MD_Metadata']['$'['xmlns:gmd']] + ":" : "";
								} catch (error) {logger.warn("gmd prefix not properly defined in xml file " + file);}

								//const minX = data['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:extent'][0]['gmd:EX_Extent'][0]['gmd:geographicElement'][0]['gmd:EX_GeographicBoundingBox'][0]['gmd:westBoundLongitude'][0]['gco:Decimal'][0];
								//const maxX = data['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:extent'][0]['gmd:EX_Extent'][0]['gmd:geographicElement'][0]['gmd:EX_GeographicBoundingBox'][0]['gmd:eastBoundLongitude'][0]['gco:Decimal'][0];
								//const minY = data['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:extent'][0]['gmd:EX_Extent'][0]['gmd:geographicElement'][0]['gmd:EX_GeographicBoundingBox'][0]['gmd:southBoundLatitude'][0]['gco:Decimal'][0];
								//const maxY = data['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:extent'][0]['gmd:EX_Extent'][0]['gmd:geographicElement'][0]['gmd:EX_GeographicBoundingBox'][0]['gmd:northBoundLatitude'][0]['gco:Decimal'][0];
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
						
						db.one(metadataInsert).then((data) => {
							//console.log(file.substring(file.indexOf('-')+1, file.lastIndexOf('.')));
							idReturn.push({file: file, metadataID: data.metadata_id});
							resolve(data.metadata_id);
						}).catch(error => {logger.error("Problem inserting metadata record: " + global.pp(error));reject(error);});
					}).catch(error => {
						logger.error("Malformed XML:");
						logger.error(error);
						//TODO: rethrow?
					});
				}).catch(error => {logger.error(error);});

			}).catch(error => {logger.error("Problem processing metadata file " + file);logger.error(error);throw new Error(error);});
		} else { //not an xml file
			return Promise.resolve();
		}
	});
	return Promise.all(promises)
	.catch(error => {logger.error("Problem processing metadata for " + schemaName);logger.error(error); throw new Error(error)}).then(() => Promise.resolve(idReturn));
}



