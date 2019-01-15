const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.convert = (data, fileMetadataType) => {	
	logger.silly("enter1, data = " + global.pp(data));
	return new Promise((resolve, reject) => {
	//return Promise.resolve(data, file).then((data, file) => {
		logger.silly("enter, data = " + global.pp(data));

		const util = require("util");
		const xml2js = util.promisify(require('xml2js').parseString);

		const azgs = require("./azgsMetadata.js");
		const metadata = new azgs.Metadata();
		return xml2js(data)
		.then(uglyMetadata => {
			logger.silly("--------------------------------------------------------");
			//const fileMetadataType = file.split('.')[0].split('-')[0].toUpperCase();
			//const fileMetadataType = "ISO19115";
			if (global.metadataTypes.filter(t => t.formalNamePath).map(t => t.name)
				.includes(fileMetadataType)) {
				const metadataType = global.metadataTypes.filter(t => t.name === fileMetadataType)[0];

				try {
					logger.silly("title path = " + jsonQueryPathToArrayPath(metadataType.formalNamePath));
					const title = eval("uglyMetadata" + jsonQueryPathToArrayPath(metadataType.formalNamePath));
					logger.silly("title = " + title);
					metadata.title = title;
					logger.silly("xMin path = " + jsonQueryPathToArrayPath(metadataType.xMinPath));
					const xMin = eval("uglyMetadata" + jsonQueryPathToArrayPath(metadataType.xMinPath));
					logger.silly("xMin = " + xMin);
					metadata.bounding_box.west = xMin;
					logger.silly("xMax path = " + jsonQueryPathToArrayPath(metadataType.xMaxPath));
					const xMax = eval("uglyMetadata" + jsonQueryPathToArrayPath(metadataType.xMaxPath));
					logger.silly("xMax = " + xMax);
					metadata.bounding_box.east = xMax;
					logger.silly("yMin path = " + jsonQueryPathToArrayPath(metadataType.yMinPath));
					const yMin = eval("uglyMetadata" + jsonQueryPathToArrayPath(metadataType.yMinPath));
					logger.silly("yMin = " + yMin);
					metadata.bounding_box.south = yMin;
					logger.silly("yMax path = " + jsonQueryPathToArrayPath(metadataType.yMaxPath));
					const yMax = eval("uglyMetadata" + jsonQueryPathToArrayPath(metadataType.yMaxPath));
					logger.silly("yMax = " + yMax);
					metadata.bounding_box.north = yMax;
					logger.silly("uglyMetadata = " + global.pp(uglyMetadata));
					metadata.abstract = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:abstract'][0]['gco:CharacterString'][0];						
					const seriesArray = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'].reduce((accX, x) => {
						if (x['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:identifier']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:identifier'].reduce((accY, y) => {
								return accY.concat(y['gmd:MD_Identifier'][0]['gmd:code'][0]['gco:CharacterString'][0])
							}, []));
						} else {
							return accX;
						}
					}, [])
					logger.silly("seriesArray = " + global.pp(seriesArray));
					metadata.series = seriesArray[0] ? seriesArray[0] : "";
					const authorsArray = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'].reduce((accX, x) => {
						if (x['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:citedResponsibleParty']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:citedResponsibleParty'].reduce((accY, y) => {
								const author = new azgs.Author();
								author.person = y['gmd:CI_ResponsibleParty'][0]['gmd:individualName'][0]['gco:CharacterString'][0];
								return accY.concat(author);
								//return accY.concat(y['gmd:CI_ResponsibleParty'][0]['gmd:individualName'][0]['gco:CharacterString'][0])
							}, []));
						} else {
							return accX;
						}
					}, [])
					logger.silly("authorsArray = " + global.pp(authorsArray));
					metadata.authors = authorsArray; 
					const keywordsArray = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'].reduce((accX, x) => {
						logger.silly("x reduce");
						if (x['gmd:MD_DataIdentification'][0]['gmd:descriptiveKeywords']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]['gmd:descriptiveKeywords'].reduce((accY, y) => {
								logger.silly("y reduce");
								if (y['gmd:MD_Keywords'] && y['gmd:MD_Keywords'][0]['gmd:keyword']) {
									const kType = y['gmd:MD_Keywords'][0]['gmd:type'][0]['gmd:MD_KeywordTypeCode'][0]._;
									logger.silly("kType = " + kType);
									return accY.concat(y['gmd:MD_Keywords'][0]['gmd:keyword'].reduce((accZ, z) => {
										logger.silly("z reduce");
										const keyword = new azgs.Keyword();
										keyword.name = z['gco:CharacterString'][0];
										keyword.type = kType;
										return accZ.concat(keyword);
									}, []));
								} else {
									return accY;
								}
							}, []));
						} else {
							return accX;
						}
					}, []);
					logger.silly("keywordsArray = " + global.pp(keywordsArray));
					metadata.keywords = keywordsArray; 

					//Date can can come in two forms. Check for both.
					//Actually, there appear to be more than two, but I'm ignoring the others.
					let date;
					try {
						date = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:date'][0]['gmd:CI_Date'][0]['gmd:date'][0]['gco:Date'][0];
					} catch (error) {
						try {
							date = uglyMetadata['gmd:MD_Metadata']['gmd:identificationInfo'][0]['gmd:MD_DataIdentification'][0]['gmd:citation'][0]['gmd:CI_Citation'][0]['gmd:date'][0]['gmd:CI_Date'][0]['gmd:date'][0]['gco:DateTime'][0];
						} catch(error) {
							logger.info("Unable to determine date from metadata");
						}
					}
					if (date) {
						metadata.year = date.slice(0,4);
					}
					logger.silly("azgs metadata = " + global.pp(metadata));
				
					logger.silly("--------------------------------------------------------");
					//return Promise.resolve(metadata);
					return resolve(metadata);
				} catch (error) {
					logger.silly("--------------------------------------------------------");
					throw new Error("Problem creating azgs metadata: " + global.pp(error));
				}
			} else {
				//Not a recognized metadata type. Just return the ugly.
				return resolve(uglyMetadata);
			}
			
		})
		.catch(error => {logger.warn("Problem parsing xml: " + error); reject(error);})
	});
}

//TODO: Temporary. For dev only
function jsonQueryPathToArrayPath(jsonQPath) {
	if (jsonQPath) {
		//slice off json_data prefix if present
		if (jsonQPath.startsWith("json_data->")) {
			jsonQPath = jsonQPath.slice(11);
		}
		if (jsonQPath.startsWith(">")) { //TODO: consolidate with previous
			jsonQPath = jsonQPath.slice(1);
		}
		const regex =/(.+?)(->{1,2}|$)/gm;
		return jsonQPath.replace(regex, (a, b) => {
			return '[' + b.trim() + ']';
		});
	}
	throw new Error("JSON query path not defined");
}

