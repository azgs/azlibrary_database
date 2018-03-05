exports.upload = (dir, datasetName, collectionID, db) => {
	console.log("processing metadata");

	const jsonPromise = new Promise((resolve, reject) => {
		console.log("processing json metadata");
		const jsonPath = process.cwd() + "/" + dir + "/" +  datasetName + ".json";
		let jsonMetadata	
		try {
			jsonMetadata = require(jsonPath);
		} catch (err) {
			console.log("JSON metadata file not found");
			return resolve();
		}

		const metadataInsert = 
			"insert into metadata.json_entries (collection_id, metadata, metadata_file) values (" +
			collectionID + ", $$" +
			JSON.stringify(jsonMetadata) + "$$, $$" +
			jsonPath + "$$)";
		//console.log(metadataInsert);
		//return db.none(metadataInsert).catch(error => {/*throw new Error(error);*/console.log(error)});
		db.none(metadataInsert).then(() => {
			resolve();
		}).catch(error => {reject(error);});
		
	}).catch(error => {/*throw new Error(error);*/console.log(error);});

	const xmlPromise = new Promise((resolve, reject) => {
		console.log("processing xml metadata");

		//read xml file
		const xmlPath = process.cwd() + "/" + dir + "/" + datasetName + ".xml";
		let xmlMetadata
		let fs = require('fs');

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
			const xmlPath = process.cwd() + "/" + dir + "/" + datasetName + ".xml";
			const metadataInsert = 
				"insert into metadata.xml_entries (collection_id, textdata, xmldata, metadata_file) values (" +
				collectionID + ", $$" + 
				data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
				data.substr(1, data.length-1) + "$$, $$" + //There appears to be a garbage character at the beginning
				xmlPath + "$$)";
			//console.log(metadataInsert);
			//return db.none(metadataInsert).catch(error => {throw new Error(error);});
			db.none(metadataInsert).then(() => {
				resolve();
			}).catch(error => {reject(error);});
		});

	}).catch(error => {/*throw new Error(error);*/console.log(error);});

	const promises = [
		jsonPromise,
		xmlPromise
	];
	return Promise.all(promises);
}



