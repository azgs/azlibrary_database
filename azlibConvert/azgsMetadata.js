"use strict";

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

