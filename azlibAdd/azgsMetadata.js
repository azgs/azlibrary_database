"use strict";

const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.readMetadata = (rootDir) => {
	logger.debug("enter read");

	const path = require('path');
	const azgsPath = path.join(rootDir, "azgs.json");

	//Verify that azgs.json exists
	const fs = require('fs-extra');
	if (!fs.existsSync(azgsPath)) {
		return Promise.reject("No azgs.json file found in collection");
	}
	logger.silly("reading json");
	return fs.readJson(azgsPath)
	.catch(error => {logger.warn("Problem reading azgs.json: " + error);return Promise.reject(error);})
}

exports.upload = (metadata, collectionID, db) => {
	logger.debug("enter");

	return Promise.resolve().then(() => {      
		logger.silly("metadata = " + global.pp(metadata));

		//Ach, Javascript. Takes all this to make sure we have numbers. 
		//Number catches strings like "7x", and parseFloat catches blanks and empty strings.
		if (isNaN(Number(metadata.bounding_box.west)) || isNaN(parseFloat(metadata.bounding_box.west)) ||
			isNaN(Number(metadata.bounding_box.south)) || isNaN(parseFloat(metadata.bounding_box.south)) ||
			isNaN(Number(metadata.bounding_box.east)) || isNaN(parseFloat(metadata.bounding_box.east)) ||
			isNaN(Number(metadata.bounding_box.north)) || isNaN(parseFloat(metadata.bounding_box.north))) {
			return Promise.reject("Invalid bounding box in metadata");
		}

		const metadataInsert = 
			"insert into metadata.azgs (collection_id, json_data) values (" +
			collectionID + ", $$" + 
			JSON.stringify(metadata) + "$$)";

		logger.silly("insert = " + metadataInsert);

		return db.none(metadataInsert)
		.catch(error => {
			logger.error("Problem inserting azgs metadata record: " + global.pp(error));
			return Promise.reject("Problem inserting azgs metadata record. Error from DB: " + error);
		/*
		}).then(() => {
			//I've moved maintenance of metadata for previous collections here
			//to keep metadata stuff together.
			if (!metadata.identifiers.supersedes) {
				return Promise.resolve();
			}
			//...if there were previous collections...
			
			const previousPromises = metadata.identifiers.supersedes.map(
				previousCollection => {
					logger.info("previousCollection = " + previousCollection)
					//...get identifiers from db then...
					const identifiersSQL = `
						select
							c.collection_id,
							m.json_data['identifiers'] as identifiers
						from
							metadata.azgs m,
							public.collections c
						where
							c.collection_id = m.collection_id and
							c.perm_id = $1
					`;
					return db.one(identifiersSQL, [
						previousCollection
					]).then((result) => {
						//...update their superseded_by...
						if (result.identifiers.superseded_by) {
							result.identifiers.superseded_by.push(metadata.identifiers.perm_id)
						} else {
							result.identifiers.superseded_by = [metadata.identifiers.perm_id]; 
						}	

						const identifiersUpdateSQL = `
							update
								metadata.azgs
							set
								json_data['identifiers'] = $2::jsonb
							where
								collection_id = $1
									
						`
						//...and write that change to metadata.azgs.
						return db.none(identifiersUpdateSQL, [
							result.collection_id,
							JSON.stringify(result.identifiers)
						]);
					})
				}
			);
			return Promise.all(previousPromises);
		*/
		})
		/*
		.then(() => {
			let azgs_old_url;
			if (metadata.links[0]) {
				azgs_old_url = metadata.links[0].url;
			}
			const collectionsUpdate = "update collections set formal_name = $$" + metadata.title + 
										"$$, informal_name = $$" + metadata.informal_name + 
										"$$, azgs_old_url = $$" + azgs_old_url + 
										"$$ where collection_id = " + metadata.identifiers.collection_id;
			return db.none(collectionsUpdate).catch(error => {
				logger.error("Problem updating formal_name in collections: " + global.pp(error));
				return Promise.reject(error);
			});
		});
		*/
		
	});
};

exports.Metadata =	class {
	constructor () {
		this.title = null;
		this.authors = [];
		this.collection_group = {
			name: null,
		};
		this.year = null;
		this.journal = {
			name: null,
			publisher: null,
			url: null
		}
		this.series = null;
		this.abstract = null;
		this.links = [];
		this.identifiers = {
			perm_id: null,
			directory: null,
			doi: null
		};
		this.files = [];
		this.language = "English", // prepopulate english
		this.license = {
			type: "CC BY-NC-SA 4.0",
			url: "https://creativecommons.org/licenses/by-nc-sa/4.0/"
		};
		this.keywords = [];
		this.informal_name = null;    
		this.bounding_box = {
			north: null,
			south: null,
			east: null,
			west: null
		};
		this.private = "false" //prepopulate false?
	}
};


exports.Author = class {
	constructor() {	
		this.person = null;
		this.organization = null;
		this.givenname= null;
		this.surname = null;
	}
};       

exports.Link = class {
	constructor() {	
		this.url = null;
		this.name = null;
	}
};

exports.File = class {
	constructor() {	
		this.name = null;
		this.type = null;
	}
};          

exports.Keyword = class {
	constructor() {	
		this.name = null;
		this.type = null;
	}
};


