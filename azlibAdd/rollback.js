/*
This is a brute force approach that uses info from information_schema to find tables with records
to be deleted. The nice thing about this is that it contains all rollback logic in one place. 
The downside is that it does not get rid of tables introduced into the geodata schema by the 
collection that has failed. Not sure how bad that is. It could result in unused tables. But 
presumably this collection will get uploaded eventually, once the problem is corrected, and 
the tables would get used.
TODO: Consider putting rollback logic in each schema handler. Or at least, in the gdb handler.
*/

exports.rollback = (collectionID, db) => {
	console.log("rolling back upload for collection_id " + collectionID);

	return db.any("select table_schema, table_name from information_schema.columns where column_name = 'collection_id' and table_schema <> 'public'")	
	.then(tables => {
		//console.log(tables);
		const promises = tables.map(table => {
			//console.log(table);
			return db.none("delete from " + table.table_schema + ".\"" + table.table_name + "\" where collection_id = " + collectionID + " or collection_id is null");
		});

		promiseUtil = require("./promise_util");
		return Promise.all(promises.map(promiseUtil.reflect)).then(results => {
			if (results.filter(result => result.status === "rejected").length === 0) {
				return Promise.resolve();
			} else {
				return Promise.reject(results);
			}
		});
	}).catch(error => {
		console.log("One or more errors occurred during rollback.");
		console.log(error);
		console.log("Manual rollback required for collection_id " + collectionID + ".");
		//return Promise.resolve();
	});
}


