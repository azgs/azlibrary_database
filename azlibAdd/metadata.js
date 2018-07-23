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

				return db.one(metadataInsert).then((data) => {
					idReturn.push({file: file, metadataID: data.metadata_id});
					return Promise.resolve(data.metadata_id);
				}).catch(error => {logger.error("Problem inserting metadata record: " + global.pp(error));return Promise.reject(error);});
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



