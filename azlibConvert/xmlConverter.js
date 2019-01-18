const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.convert = (data, fileMetadataType) => {	
	logger.silly("enter1, data = " + global.pp(data));

	return new Promise((resolve, reject) => {
	//return Promise.resolve(data, file).then((data, file) => {
		logger.silly("enter, data = " + global.pp(data));

		if ("ISO19115" !== fileMetadataType.toUpperCase() &&
			"ISO19139" !== fileMetadataType.toUpperCase()) {
			return reject(new Error("Unsupported metadata type"));
		}

		const util = require("util");
		const xml2js = util.promisify(require('xml2js').parseString);

		const azgs = require("./azgsMetadata.js");
		const metadata = new azgs.Metadata();
		return xml2js(data)
		.then(uglyMetadata => {
			logger.silly("--------------------------------------------------------");
			logger.silly("uglyMetadata = " + global.pp(uglyMetadata));
			//const fileMetadataType = file.split('.')[0].split('-')[0].toUpperCase();
			//const fileMetadataType = "ISO19115";
			if (["ISO19115", "ISO19139"].includes(fileMetadataType)) {
				//const metadataType = global.metadataTypes.filter(t => t.name === fileMetadataType)[0];

				try {
					metadata.title = uglyMetadata['gmd:MD_Metadata']
										['gmd:identificationInfo'][0]
											['gmd:MD_DataIdentification'][0]
												['gmd:citation'][0]
													['gmd:CI_Citation'][0]
														['gmd:title'][0]
															['gco:CharacterString'][0];

					metadata.bounding_box.west = uglyMetadata['gmd:MD_Metadata']
													['gmd:identificationInfo'][0]
														['gmd:MD_DataIdentification'][0]
															['gmd:extent'][0]
																['gmd:EX_Extent'][0]
																	['gmd:geographicElement'][0]
																		['gmd:EX_GeographicBoundingBox'][0]
																			['gmd:westBoundLongitude'][0]
																				['gco:Decimal'][0];

					metadata.bounding_box.east = uglyMetadata['gmd:MD_Metadata']
													['gmd:identificationInfo'][0]
														['gmd:MD_DataIdentification'][0]
															['gmd:extent'][0]
																['gmd:EX_Extent'][0]
																	['gmd:geographicElement'][0]
																		['gmd:EX_GeographicBoundingBox'][0]
																			['gmd:eastBoundLongitude'][0]
																				['gco:Decimal'][0];

					metadata.bounding_box.south = uglyMetadata['gmd:MD_Metadata']
													['gmd:identificationInfo'][0]
														['gmd:MD_DataIdentification'][0]
															['gmd:extent'][0]
																['gmd:EX_Extent'][0]
																	['gmd:geographicElement'][0]
																		['gmd:EX_GeographicBoundingBox'][0]
																			['gmd:southBoundLatitude'][0]
																				['gco:Decimal'][0];

					metadata.bounding_box.north = uglyMetadata['gmd:MD_Metadata']
													['gmd:identificationInfo'][0]
														['gmd:MD_DataIdentification'][0]
															['gmd:extent'][0]
																['gmd:EX_Extent'][0]
																	['gmd:geographicElement'][0]
																		['gmd:EX_GeographicBoundingBox'][0]
																			['gmd:northBoundLatitude'][0]
																				['gco:Decimal'][0];

					metadata.abstract = uglyMetadata['gmd:MD_Metadata']
											['gmd:identificationInfo'][0]
												['gmd:MD_DataIdentification'][0]
													['gmd:abstract'][0]
														['gco:CharacterString'][0];	
					
					const seriesArray = uglyMetadata['gmd:MD_Metadata']
											['gmd:identificationInfo'].reduce((accX, x) => {
						if (x['gmd:MD_DataIdentification'][0]
								['gmd:citation'][0]
									['gmd:CI_Citation'][0]
										['gmd:identifier']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]
													['gmd:citation'][0]
														['gmd:CI_Citation'][0]
															['gmd:identifier'].reduce((accY, y) => {
								return accY.concat(y['gmd:MD_Identifier'][0]
														['gmd:code'][0]
															['gco:CharacterString'][0])
							}, []));
						} else {
							return accX;
						}
					}, [])
					logger.silly("seriesArray = " + global.pp(seriesArray));
					metadata.series = seriesArray[0] ? seriesArray[0] : "";

					metadata.authors = uglyMetadata['gmd:MD_Metadata']
											['gmd:identificationInfo'].reduce((accX, x) => {
						if (x['gmd:MD_DataIdentification'][0]
								['gmd:citation'][0]
									['gmd:CI_Citation'][0]
										['gmd:citedResponsibleParty']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]
													['gmd:citation'][0]
														['gmd:CI_Citation'][0]
															['gmd:citedResponsibleParty'].reduce((accY, y) => {
								const author = new azgs.Author();
								author.person = y['gmd:CI_ResponsibleParty'][0]
													['gmd:individualName'][0]
														['gco:CharacterString'][0];
								return accY.concat(author);
							}, []));
						} else {
							return accX;
						}
					}, [])
					//logger.silly("authorsArray = " + global.pp(authorsArray));
					//metadata.authors = authorsArray; 

					metadata.keywords = uglyMetadata['gmd:MD_Metadata']
											['gmd:identificationInfo'].reduce((accX, x) => {
						logger.silly("x reduce");
						if (x['gmd:MD_DataIdentification'][0]
								['gmd:descriptiveKeywords']) {							
							return accX.concat(x['gmd:MD_DataIdentification'][0]
													['gmd:descriptiveKeywords'].reduce((accY, y) => {
								logger.silly("y reduce");
								if (y['gmd:MD_Keywords'] && y['gmd:MD_Keywords'][0]['gmd:keyword']) {
									const kType = y['gmd:MD_Keywords'][0]
														['gmd:type'][0]
															['gmd:MD_KeywordTypeCode'][0]._;
									logger.silly("kType = " + kType);
									return accY.concat(y['gmd:MD_Keywords'][0]
															['gmd:keyword'].reduce((accZ, z) => {
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
					//logger.silly("keywordsArray = " + global.pp(keywordsArray));
					//metadata.keywords = keywordsArray; 

					//Date can can come in two forms. Check for both.
					//Actually, there appear to be more than two, but I'm ignoring the others.
					let date;
					try {
						date = uglyMetadata['gmd:MD_Metadata']
									['gmd:identificationInfo'][0]
										['gmd:MD_DataIdentification'][0]
											['gmd:citation'][0]
												['gmd:CI_Citation'][0]
													['gmd:date'][0]
														['gmd:CI_Date'][0]
															['gmd:date'][0]
																['gco:Date'][0];
					} catch (error) {
						try {
							date = uglyMetadata['gmd:MD_Metadata']
										['gmd:identificationInfo'][0]
											['gmd:MD_DataIdentification'][0]
												['gmd:citation'][0]
													['gmd:CI_Citation'][0]
														['gmd:date'][0]
															['gmd:CI_Date'][0]
																['gmd:date'][0]
																	['gco:DateTime'][0];
						} catch(error) {
							logger.info("Unable to determine date from metadata");
						}
					}
					if (date) {
						metadata.year = date.slice(0,4);
					}

					if (uglyMetadata['gmd:MD_Metadata']
											['gmd:distributionInfo'][0] &&
						uglyMetadata['gmd:MD_Metadata']
											['gmd:distributionInfo'][0]
												['gmd:MD_Distribution'][0] &&
						uglyMetadata['gmd:MD_Metadata']
											['gmd:distributionInfo'][0]
												['gmd:MD_Distribution'][0]
													['gmd:transferOptions'][0]) {
	 					metadata.links = uglyMetadata['gmd:MD_Metadata']
											['gmd:distributionInfo'][0]
												['gmd:MD_Distribution'][0]
													['gmd:transferOptions'].reduce((accTransferOptions, transferOption) => {

							if (transferOption['gmd:MD_DigitalTransferOptions'][0] &&
								transferOption['gmd:MD_DigitalTransferOptions'][0]
									['gmd:onLine'][0]) {
								return accTransferOptions.concat(
									transferOption['gmd:MD_DigitalTransferOptions'][0]
										['gmd:onLine'].reduce((accOnline, online) => {
									if (online['gmd:CI_OnlineResource'][0] &&
										online['gmd:CI_OnlineResource'][0]
											['gmd:linkage'][0] &&
										online['gmd:CI_OnlineResource'][0]
											['gmd:linkage'][0]
												['gmd:URL']) {
										const link = new azgs.Link();
										link.url = online['gmd:CI_OnlineResource'][0]
														['gmd:linkage'][0]
															['gmd:URL'][0];
										if (online['gmd:CI_OnlineResource'][0]
												['gmd:name'] &&
											online['gmd:CI_OnlineResource'][0]
												['gmd:name'][0] &&
											online['gmd:CI_OnlineResource'][0]
												['gmd:name'][0]
													['gco:CharacterString']) {
											link.name = online['gmd:CI_OnlineResource'][0]
															['gmd:name'][0]
																['gco:CharacterString'][0];
										}
										return accOnline.concat(link);
									} else {
										return accOnline
									}
								}, []));
							} else {
								return accTransferOptions;
							}
						}, []);
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
		.catch(error => {logger.warn("Problem parsing xml: " + global.pp(error)); reject(error);})
	});
}



