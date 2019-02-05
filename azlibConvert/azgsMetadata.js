"use strict";

exports.Metadata =	class {
	constructor () {
		this.title = null;
		this.authors = [];
		this.collection_group = {
			name: null,
			id: null
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
			collection_id: null,
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
		this.extension = null;
		this.type = null;
	}
};          

exports.Keyword = class {
	constructor() {	
		this.name = null;
		this.type = null;
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

