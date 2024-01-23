#!/usr/bin/env node

const path = require("path");
const fs = require('fs-extra');

global.pp = (object) => {
	return require('util').inspect(object, {depth:null, maxArrayLength: null});
};


global.args = require('commander');

global.args
	.version('0.0.1')
	//.option('-s, --source <source>', 'Source directory of the gdb. Required')
	.option('-l, --loglevel <loglevel>', 'Indicates logging level (error, warn, info, verbose, debug, silly). Default is info.', 'info')
	.option('-g, --gdbschema <gdb-schema>', 'Geodatabase schema in DB. If a recognized schema name (e.g. ncgmp09, gems), schema will be prepped accordingly. Required')
	.option('-d, --dbname <dbname>', 'DB name. Required')
	.option('-u, --username <username>', 'DB username. Required')
	.option('-p, --password <password>', 'DB password (will be prompted if not included)')
        .option('-h, --host <host>', 'Postgres host')
        .option('-o, --port <port>', 'Postgres port')
        .option('-s, --cert <cert>', 'SSL public cert for PG')
	.option('-c, --create ', 'Create schema but do not load it (used for temporary schemas when importing collections)')
	.parse(process.argv);

const logger = require("./logger")(path.basename(__filename));

//This routine is to facilitate db debugging. It is not necessary.
const initOptions = {
    error: function (error, e) {
        if (e.cn) {
            // A connection-related error;
            //logger.debug("CN:", e.cn);
            logger.debug("EVENT:", error.message);
        }
    }
};
const pgp = require("pg-promise")(initOptions);
/*
const pgp = require("pg-promise")({
	// Initialization Options
});
*/
let db;

//TODO: Kind of cheesy to have to do this to get path to this folder. Is there a better way?
const pathToMe = require("global-modules-path").getPath("azlibConfigGDB");

// get password sorted
let promise = new Promise((resolve) => {
	if (args.length === 4) {
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
		resolve(args.password);
	}
});


promise.then((password) => {
	args.password = password;
	logger.debug("password resolved");

        let cn = {
                user: global.args.username,
                password: global.args.password,
                host: global.args.host,
                database: global.args.dbname,
                port: global.args.port,
        };

        if (global.args.cert) {
                cn.ssl = {
                        rejectUnauthorized: true,
                        ca: fs.readFileSync(global.args.cert).toString(),
                };
        }
       	logger.silly(global.pp(cn));

	db = pgp(cn);

	return db.tx((t) => {
		logger.debug("creating schema " + global.args.gdbschema);

		//create schema
		return t.none('create schema ' + global.args.gdbschema)
		.catch(error => {
			logger.error("schema creation failed");
			throw new Error(error);})
		.then(() => {
			logger.debug(`empty schema ${args.gdbschema}  created`);
			if (global.args.create) {
				logger.silly("create schema only, we're done");
				return Promise.resolve(); //We're done in this case
			}
			logger.silly("fleshing out schema");

			//TODO: The gems sql file is a placeholder. Real one is in development.
			const schemaFile = global.args.gdbschema.toLowerCase() === "ncgmp09" ?
								"ncgmp09.sql" :
								global.args.gdbschema.toLowerCase() === "gems2" ?
									"gems2.sql" :
									null;
			if (schemaFile) {
				const pgpFile = pgp.QueryFile(path.join(pathToMe, 'schemas', schemaFile), {minify: true, params: args.gdbschema});
				return t.none(pgpFile).catch(error => {
					logger.error("Problem processing gdb template: ");console.log(error); 
					throw new Error(error);
				});
			} else {
				return Promise.reject("Unknown gdb schema type");
			}
		});
	});
}).then(() => {
	logger.debug("Schema created");
	pgp.end();
})
.catch(error => { 
	logger.error(error);
	pgp.end();
	process.exit(1);
});





