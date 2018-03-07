exports.upload = (dir, datasetName, collectionID, db) => {
	console.log("processing metadata");

	dir = dir + "/metadata";

	//Verify that directory exists
	const fs = require('fs');
	if (!fs.existsSync(dir)) {
		console.log("No metadata directory found");
		return Promise.resolve();
	}

	//Get list of types for comparison to filenames
	return db.any("select type_name from metadata.types").then((data) => {
		const metadataTypes = data.map((type) => {
			return type.type_name;
		});
		console.log("metadata types = "); console.log(metadataTypes);

		//const fs = require('fs');
		const path = require('path');
		const listFiles = p => fs.readdirSync(p).filter(f => !fs.statSync(path.join(p, f)).isDirectory());
		const files = listFiles(dir);
		console.log("files = "); console.log(files);

		//Process each file
		const promises = files.map((file) => {
			const type = file.split('-')[0].toUpperCase();

			//If type is not recognized, ignore file
			if (!metadataTypes.includes(type)) {
				console.log("Invalid metadata type: " + type);
				return Promise.resolve();
			}
			//console.log("type = " + type);

			console.log("file = " + file);
			//console.log("filerazzle = " + file.split('.')[file.split('.').length-1]);
			if (file.split('.')[file.split('.').length-1].toUpperCase() === "JSON") {
				return new Promise((resolve, reject) => {
					console.log("processing json metadata");
					
					const jsonPath = process.cwd() + "/" + dir + "/" +  file;
					const jsonMetadata = require(jsonPath);
					//console.log(jsonMetadata);

					const metadataInsert = 
						"insert into metadata.json_entries (collection_id, type, metadata, metadata_file) values (" +
						collectionID + ", $$" +
						type + "$$, $$" + 
						JSON.stringify(jsonMetadata) + "$$, $$" +
						jsonPath + "$$)";
					//console.log(metadataInsert);
					//return db.none(metadataInsert).catch(error => {/*throw new Error(error);*/console.log(error)});
					db.none(metadataInsert).then(() => {
						resolve();
					}).catch(error => {reject(error);});
		
				}).catch(error => {/*throw new Error(error);*/console.log(error);});
			} else if (file.split('.')[file.split('.').length-1].toUpperCase() === "XML") {
				new Promise((resolve, reject) => {
					console.log("processing xml metadata");

					//read xml file
					const xmlPath = process.cwd() + "/" + dir + "/" + file;
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
						//console.log("xml data = " + data);
						const metadataInsert = 
							//"insert into metadata.xml_entries (collection_id, textdata, xmldata, metadata_file) values (" +
							"insert into metadata.xml_entries (collection_id, type, textdata, metadata_file) values (" +
							collectionID + ", $$" + 
							type + "$$, $$" + 
							data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
							//data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
							xmlPath + "$$)";
						//console.log(metadataInsert);
						//return db.none(metadataInsert).catch(error => {throw new Error(error);});
						db.none(metadataInsert).then(() => {
							resolve();
						}).catch(error => {reject(error);});
					});

				}).catch(error => {/*throw new Error(error);*/console.log(error);});
			}
		});
		return Promise.all(promises);
	}).catch(error => {console.log(error); throw new Error(error)});
}



