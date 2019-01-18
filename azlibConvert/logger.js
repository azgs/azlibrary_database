const { createLogger, format, transports } = require('winston');

const pFormat = format.printf(info => {
  return `${info.timestamp} (${info.level.toUpperCase()}) ${info.message}`;
});

const logger = createLogger({
	level: global.args.loglevel,
  	format: format.combine(
		format.timestamp(),
		//format.prettyPrint()
		pFormat
  	),
  	transports: [new transports.Console()]
});

module.exports = function(fileName) {    
    var myLogger = {
        error: function(text) {
            logger.error(global.datasetName + ", " + fileName + ': ' + text)
        },
        warn: function(text) {
            logger.warn(global.datasetName + ", " + fileName + ': ' + text)
        },
        info: function(text) {
            logger.info(global.datasetName + ", " + fileName + ': ' + text)
        },
        debug: function(text) {
            logger.debug(global.datasetName + ", " + fileName + ': ' + text)
        },
        silly: function(text) {
            logger.silly(global.datasetName + ", " + fileName + ': ' + text)
        }
    }

    return myLogger
}
