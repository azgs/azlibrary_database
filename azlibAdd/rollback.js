/*
This is a brute force approach that uses info from information_schema to find tables with records
to be deleted. The nice thing about this is that it contains all rollback logic in one place. 
The downside is that it does not get rid of tables introduced into the geodata schema by the 
collection that has failed. Not sure how bad that is. It could result in unused tables. But 
presumably this collection will get uploaded eventually, once the problem is corrected, and 
the tables would get used.
TODO: Consider putting rollback logic in each schema handler. Or at least, in the gdb handler.
*/
const path = require("path");
const logger = require("./logger")(path.basename(__filename));

exports.rollback = (collectionID, db) => {
	logger.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!rolling back!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
	logger.debug("enter, collection_id = " + collectionID);


	if (!collectionID) {
		logger.info("Nothing to rollback; collectionID is undefined.");
		return Promise.resolve();
	}

	return db.any("select table_schema, table_name from information_schema.columns where column_name = 'collection_id' and table_schema <> 'public'")	
	.then(tables => {
		//console.log(tables);

		const dataTables = [];
		const metadataTables = tables.reduce((acc, table) => {
			if (table.table_name.toUpperCase() === "METADATA") {
		 		acc.push(table);
			} else {
				dataTables.push(table);
			}
			return acc;
		}, []);	
			
		logger.debug("dataTables = " + global.pp(dataTables));
		logger.debug("metadataTables = " + global.pp(metadataTables));

		const dataPromises = dataTables.map(table => {
			//console.log(table);
			return db.none("delete from " + table.table_schema + ".\"" + table.table_name + "\" where collection_id = " + collectionID + " or collection_id is null");
		});

		const metadataPromises = metadataTables.map(table => {
			//console.log(table);
			return db.none("delete from " + table.table_schema + ".\"" + table.table_name + "\" where collection_id = " + collectionID + " or collection_id is null");
		});

		//First clean dataTables, then metadataTables (to avoid fk violations)
		promiseUtil = require("./promise_util");
		return Promise.all(dataPromises.map(promiseUtil.reflect)).then(results => {
			if (results.filter(result => result.status === "rejected").length === 0) {
				return Promise.all(metadataPromises.map(promiseUtil.reflect)).then(results => {
					if (results.filter(result => result.status === "rejected").length === 0) {
					logger.info("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!rollback complete!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
						return Promise.resolve(results);
					} else {
						return Promise.reject(results);
					} 
				});
			} else {
				return Promise.reject(results);
			}
		});
	}).catch(error => {
		//console.log("One or more errors occurred during rollback.");
		//console.log(error);
		//console.log("Manual rollback required for collection_id " + collectionID + ".");
		logger.error("One or more errors occurred during rollback. Manual rollback required for collection_id " + collectionID + ".");
		logger.error(global.pp(error));		
		return Promise.reject(error);
	});
}


