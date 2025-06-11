#!/usr/bin/env node

const fs = require("fs-extra");

const args = process.argv.slice(2);

if (args[0] === "--help") {
	console.log("Usage: azlibScrapeMineData db_name db_user [db_password]");
	return;
}

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;

// get password sorted
let pwPromise = new Promise((resolve) => {
	if (args.length === 2) {
		const prompt = require('prompt');
	  	prompt.message = "";
	  	prompt.delimiter = "";
		prompt.start();
		prompt.get([{
			name: 'postgres password',
		    hidden: true,
			replace: '*'
		}], (err, result) => {
			resolve(result['postgres password']);
		});
	} else {
		resolve(args[2]);
	}
});

async function testConnection(db) {
	console.log("testing connection")
    const c = await db.connect(); // try to connect
	console.log("connected")
    c.done(); // success, release connection
	console.log("connection released")
    return c.client.serverVersion; // return server version
}

pwPromise.then(async (password) => {
	console.log("start")
	args[2] = password;

	const server = args[3] || 'localhost'
	/*
	const cn = 'postgres://' + args[1] + ':' + args[2] + '@localhost:5432/' + args[0];
	console.log(cn)
	db = pgp(cn);
	console.log("have db")
	//console.log(db)
	*/
/*
	console.log("about to check")
	const sv = await testConnection(db)
	console.log(sv)
	console.log("after check")
*/
	
	let conn = {
		user: args[1],
		password: args[2],
		host: server,
		database: args[0],
		port: '5432',
	};
	if ("localhost" !== server) {
		conn.ssl = {
			rejectUnauthorized: true,
			ca: fs.readFileSync('global-bundle.pem').toString(),
		};
	}

	db = pgp(conn);
	console.log("have db")
	console.log(db)

	//get old azgs link for each ADMM collection...
	const oldLinks = await db.any(`
		SELECT 
			collection_id,
			json_data->'identifiers'->>'perm_id' as perm_id,
			json_data,
			arr.link_object->>'url' as azgsURL
		FROM 
			metadata.azgs,
			jsonb_array_elements(json_data->'links') with ordinality arr(link_object, position) 
		WHERE 
			json_data->'identifiers'->>'perm_id' like 'ADMM%' and
			arr.link_object->>'name' = 'AZGS old' and
			arr.link_object->>'url' ~ '^https:\/\/minedata'	
	`)

	console.log("process oldLinks")
	for (link of oldLinks) {
		//console.log(link)
		try {
			//Note: minedata url has been replaced with magazine url, due to DDOS attack on minedata.azgs.az.gov
			const response = await fetch(link.azgsurl.replace('minedata', 'magazine'));
			if (!response.ok) {
				throw new Error(`Response status: ${response.status}`);
			}
		
			const body = await response.text();
			const resourceID = body.match(/Resource ID:&nbsp;<\/div><div class="field-items"><div class="field-item even">(.*?)<\/div>/)[1]
			const collection = body.match(/Collection:&nbsp;<\/div><div class="field-items"><div class="field-item even">(.*?)<\/div>/)[1]

			let startDate, endDate
			try {
				startDate = body.match(/Start Date:&nbsp;<\/div><div class="field-items"><div class="field-item even">(.*?)<\/div>/)[1]
				endDate = body.match(/End Date:&nbsp;<\/div><div class="field-items"><div class="field-item even">(.*?)<\/div>/)[1]
			} catch (error) {
				startDate = null
				endDate = null
			} 

			console.log("----------------------")
			console.log(link.azgsurl);
			console.log(link.collection_id)
			console.log(link.perm_id)
			console.log(resourceID);
			console.log(collection);
			console.log(startDate);
			console.log(endDate);

			//update metadata
			link.json_data.mine_data = {
				resource_id: resourceID,
				collection: collection,
				//conditional spread on these, since they could be null
				...(startDate ? { start_date: startDate } : {}),
				...(endDate ? { end_date: endDate } : {})
			}

			console.log(link.json_data.mine_data)
			console.log("----------------------\n\n")

			/* 
			//Test fetch before uncommenting update
			await db.none(`
				update
					metadata.azgs
				set
					json_data = $1 
				where 
					collection_id = $2
			`, [link.json_data, link.collection_id])
			*/
		} catch (error) {
			console.error(error.message);
			console.error("     " + link.perm_id)
			console.error("     " + link.azgsurl)
		}		
	}
	return Promise.resolve();
}).then(data => {
	console.log("graceful end")
	pgp.end();
}).catch(error => {
	console.log("ugly end")
	pgp.end();
	console.log(error);
});































