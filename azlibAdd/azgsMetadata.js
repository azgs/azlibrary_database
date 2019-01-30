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

exports.upload = (metadata, db) => {
	logger.debug("enter");

	return Promise.resolve().then(() => {      
		logger.silly("metadata = " + global.pp(metadata));
		
		const metadataInsert = 
			"insert into metadata.azgs (collection_id, json_data, geom) values (" +
			metadata.identifiers.collection_id + ", $$" + 
			JSON.stringify(metadata) + "$$, " +
			"ST_MakeEnvelope(" + 
				metadata.bounding_box.west + "," + 
				metadata.bounding_box.south + "," + 
				metadata.bounding_box.east + "," + 
				metadata.bounding_box.north + ",4326))";

		logger.silly("insert = " + metadataInsert);

		return db.none(metadataInsert)
		.catch(error => {
			logger.error("Problem inserting azgs metadata record: " + global.pp(error));
			return Promise.reject("Problem inserting azgs metadata record: " + error);
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
		
/*
		return db.tx(t => { 
			const metadataInsert = 
				"insert into metadata.azgs (collection_id, json_data, geom) values (" +
				collectionID + ", $$" + 
				JSON.stringify(metadata) + "$$, " +
				"ST_MakeEnvelope(" + metadata.bounding_box.west + "," + 
					metadata.bounding_box.south + "," + 
					metadata.bounding_box.east + "," + 
					metadata.bounding_box.north + ",4326))";
			logger.silly("insert = " + metadataInsert);

			const collectionsUpdate = "update public.collections set formal_name = $$" + metadata.title + 
										"$$, informal_name = $$" + metadata.informal_name + 
										"$$ where collection_id = " + collectionID;
			logger.silly("update for = " + collectionsUpdate);

			return t.batch([metadataInsert, collectionsUpdate]);
		})
		.then(data => {
			logger.silly("azgs metadata successful");
		})
		.catch(error => {logger.error(error);throw new Error(error);});
*/

	});
};

exports.Metadata =	class {
	constructor () {
		this.title = "";
		this.authors = [];
		this.collection_group = {
			name: "",
			id: ""
		};
		this.year = "";
		this.journal = {
			name: "",
			publisher: "",
			url: ""
		}
		this.series = "";
		this.abstract = "";
		this.links = [];
		this.identifiers = {
			collection_id: "",
			directory: "",
			doi: ""
		};
		this.files = [];
		this.language = "English", // prepopulate english
		this.license = {
			type: "",
			url: ""
		};
		this.keywords = [];
		this.informal_name = "";    
		this.bounding_box = {
			north: "",
			south: "",
			east: "",
			west: ""
		};
		this.private = "false" //prepopulate false?
	}
};


exports.Author = class {
	constructor() {	
		this.person = "";
		this.organization = "";
		this.givenname= "";
		this.surname = "";
	}
};       

exports.Link = class {
	constructor() {	
		this.url = "";
		this.name = "";
	}
};

exports.File = class {
	constructor() {	
		this.name = "";
		this.extension = "";
		this.type = "";
	}
};          

exports.Keyword = class {
	constructor() {	
		this.name = "";
		this.type = "";
	}
};




/*
exports.metadata =	{
	"title": "", // required
	"authors": [ 
		//0..n author        
	],
	"collection_group": {
		"name": "",
		"id": ""
	},
	"year": "", // required 
	"journal": {
		"name": "",
		"publisher": "",
		"url": ""
	},
	"series": "", // required
	"abstract": "", // required
	"links": [
		//0..n link
	],
	"identifiers": {
		"collection_id": "",
		"directory": "", // required
		"doi": ""
	},
	"files": [ 
		//0..n file          
	],
	"language": "English", // prepopulate english
	"license": {
		"type": "", // required
		"url": "" // required
	},
	"keywords": [
		//0..n keyword
	],
	"informal_name": "", // required for NCGMP09 maps   
	"bounding_box": {
		"north": "", // required
		"south": "", // required
		"east": "", // required
		"west": "" // required
	},
	"private": "false" //prepopulate false?
};

exports.author = {
	"person": "", // required
	"organization": "",
	"givenname": "",
	"surname": ""
};       

exports.link = {
	"url": "",
	"name": ""
};

exports.file = {
	"name": "", // required
	"type": "" // required
};          

exports.keyword = {
	"name": "",
	"type": ""
};
*/

