exports.upload = (rootDir, intermediateDir, schemaName, collectionID, db) => {
	console.log("processing metadata");

	console.log("inter dir = " + intermediateDir);
	const myDir = "metadata";

	const path = require('path');
	const dir = path.join(rootDir, intermediateDir, myDir);

	//Verify that directory exists
	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No metadata directory found");
		return Promise.resolve();
	}

	const idReturn = [];

	//const fs = require('fs');
	const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
	const files = listFiles(dir);
	console.log("files = "); console.log(files);

	//Process each file
	const promises = files.map((file) => {
		const type = file.split('.')[0].split('-')[0].toUpperCase();

		//If type is not recognized, ignore file
		if (!global.metadataTypes.includes(type)) {
			console.log("Invalid metadata type: " + type);
			return Promise.resolve();
		}
		//console.log("type = " + type);

		console.log("file = " + file);
		if (file.split('.')[file.split('.').length-1].toUpperCase() === "XML") {
			return new Promise((resolve, reject) => { 
				console.log("processing xml metadata for " + file);

				//read xml file
				const xmlPath = path.resolve(dir, file);//process.cwd() + "/" + dir + "/" + file;
				//let fs = require('fs');

				new Promise((resolve) => {
					console.log("reading xml file");
					fs.readFile(xmlPath, 'utf-8', function (error, data){
						if(error) {
							console.log(error);
							resolve(null);
						}
						resolve(data);    
					}); 
				}).then((data) => {      
					console.log("processing xml content");
					if (data === null) {
						console.log("no xml data");
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
						const metadataInsert = 
							"insert into " + schemaName + ".metadata (collection_id, type, json_data, metadata_file) values (" +
							collectionID + ", $$" + 
							type + "$$, $$" + 
							JSON.stringify(data) + "$$, $$" +
							path.join(intermediateDir, myDir, file) + "$$) returning metadata_id";
						//console.log(metadataInsert);
						//return db.none(metadataInsert).catch(error => {throw new Error(error);});
						db.one(metadataInsert).then((data) => {
							//console.log(file.substring(file.indexOf('-')+1, file.lastIndexOf('.')));
							idReturn.push({file: file, metadataID: data.metadata_id});
							resolve(data.metadata_id);
						}).catch(error => {reject(error);});
					}).catch(error => {
						console.log("Malformed XML");
						console.log(error);
						//TODO: rethrow?
					});
				}).catch(error => {console.log(error);});

			}).catch(error => {console.log("Problem processing metadata file " + file);console.log(error);throw new Error(error);});
		} else { //not an xml file
			return Promise.resolve();
		}
	});
	return Promise.all(promises)
	.catch(error => {console.log("Problem processing metadata for " + schemaName);console.log(error); throw new Error(error)}).then(() => Promise.resolve(idReturn));
}



