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
			perm_id: null,
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






