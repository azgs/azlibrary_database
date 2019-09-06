#!/usr/bin/env node

//TODO: There's a lot of common code between this tool and the other two. Look into 
//refactoring into shared modules.

const path = require("path");

global.args = require('commander');

global.args
	.version('0.0.1')
	.option('-c, --collection <collection>', 'The permanent id of the collection to be deleted. Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
	//.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. Required if source directory includes a geodatabase.')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
	.parse(process.argv);

global.pp = (object) => {
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};

const logger = require("./logger")(path.basename(__filename));

logger.debug(global.pp(global.args));

// get password sorted
let pwPromise = new Promise((resolve) => {
	if (!global.args.password) {
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
		resolve(global.args.password);
	}
});

const pgp = require("pg-promise")({
	 //Initialization Options
});
let db;



pwPromise.then((password) => {

	global.args.password = password;

	const cn = 'postgres://' + global.args.username + ':' + global.args.password + '@localhost:5432/' + global.args.dbname;
	db = pgp(cn);

	return db.one(`
		select 
			collection_id 
		from 
			public.collections 
		where 
			perm_id = $1
	`, [global.args.collection]);
}).then(result => {
	return db.tx((t) => {	
		const clean = require("./clean");
		return clean.prep(result.collection_id, t);
		//logger.silly("Pretending to delete " + result.collection_id);
		//return Promise.resolve();
	});
}).catch((error) => {
	logger.error(global.pp(error));
	pgp.end();
}).then(() => {
	pgp.end();
});


		




