exports.load = (db) => {
	console.log("loading config from db");

	const promises = [
		db.any("select type_name from documents.types").then(data => {
			global.documentTypes = data.map(datum => {return datum.type_name});
			console.log("Doc types = " + global.documentTypes)
		}),
		db.any("select type_name from gisdata.raster_types").then(data => {
			global.rasterTypes = data.map(datum => {return datum.type_name});
			console.log("Raster types = " + global.rasterTypes)
		}),
		db.any("select type_name from metadata.types").then(data => {
			global.metadataTypes = data.map(datum => {return datum.type_name});
			console.log("Metadata types = " + global.metadataTypes)
		})
	];

	return Promise.all(promises).catch(error => {console.log("Problem loading config data from db:");console.log(error);throw new Error(error);});
}



