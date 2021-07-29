const _ = require('lodash');

const Logger = require('./logger');
const stringify = require('json-stringify-safe');

/**
 * Generate the InsightTransport Winston Transport.  
 * 
 * Since winston is an optional dependency, we don't force users to install
 * winston, but we still need to define our InsightPlatform class.
 * Here create the class from the passed optional winston and
 * winston-transport module which are optionally dynamically loaded at
 * runtime.
 * @param {Map} winston winston module
 * @param {Map} winstonTransport winston-transport module
 * @returns {InsightPlatform} InsightPlatform class
*/
function generateTransport(winston, winstonTransport) {
  /**
    * InsightTransport class which represents a winston transport.
    * @extends winston-transport
  */
  class InsightTransport extends winstonTransport {
    /**
     * Creates an InsightTransport
     *
     * @constructor
     * @param {Map} opts Logger options
    */
    constructor(opts) {
      super(opts);
      this.json = !!opts.json;

      const transportOpts = _.clone(opts || {});

      transportOpts.minLevel = (
        transportOpts.minLevel || transportOpts.level || this.tempLevel || 0
      );

      transportOpts.levels = transportOpts.levels || winston.config.syslog.levels;
      // Winston and Insight levels are reversed
      // ('error' level is 0 for Winston and 5 for Insight)
      // If the user provides custom levels we assume they are
      // using winston standard
      const {levels} = transportOpts;
      const values = _.values(levels).reverse();

      transportOpts.levels = {};
      _.keys(levels).forEach((k, i) => {
        transportOpts.levels[k] = values[i];
      });

      this.tempLevel = null;

      if (this.json) {
        //  If we are using JSON, winston will provide us a complete object/log message with
        //  the logger level included, so we take the level from the log.
        transportOpts.takeLevelFromLog = true;
        //  Therefore we don't want our Logger to also include level since it's duplicate data.
        //  Without this we'll get a message like this, where `_level` is a property we add in
        //  InsightLogger if withLevel is truthy:
        //  {"level":"error","message":"test error message","_level":"error"}
        transportOpts.withLevel = false;
      }

      //  store for updating InsightLogger if Winston changes logger levels
      this.minLevel = transportOpts.minLevel;

      //  Configure logger
      this.logger = new Logger(transportOpts);
      this.logger.on('error', (err) => this.emit(err));
    }

    /**
     * Log the log event.
     * Calls the Insight `logger.log` function.
     * 
     * @param {Map} info Log event passed by winston
     * @returns {void}
    */
    log(info) {
      //  This function is required since Winston passes in metadata in a strange way.
      //  Rather than giving us a complete object containing all metadata, it hides it away
      //  in the splat attribute and passes in only the first piece of metadata
      //  
      //  This seems to be an existing issue faced by devs:
      //  https://stackoverflow.com/a/60866937
      const returnMetadata = (meta) => {
        // You can format the splat yourself
        const splat = meta[Symbol.for('splat')];

        if (splat && splat.length) {
          return splat.reduce((result, current) => ({
            ...result,
            ...current
          }), {});
        }

        return {};
      };

      if (this.json) {
        //  If we are to output JSON, we create the full object containing level, message and metadata.
        //
        //  We don't serialize here but pass in an object since InsightLogger appends extra keys based on
        //  configuration, e.g. timestamp before serializing to JSON
        //
        //  We also don't specify the first argument of `level` since the winston `info` contains it.
        //  If we did provide it InsightLogger would append an extra redundant `_level` key.
        this.logger.log({
          ...info,
          ...returnMetadata(info),
        });
      } else if (Object.keys(info).length > 2) {
        //  If we are not outputting to JSON and have metadata, we use the same format as Winston
        const message = `${info.level}: ${info.message} ${stringify(returnMetadata(info))}`;

        this.logger.log(message);
      } else {
        //  If we're not outputting JSON, nor have metadata, we produce a simple message
        this.logger.log(info.level, info.message);
      }
    }

    /**
     * Write the winston log event by calling our logger.
     * 
     * This overwrites the default winston-transport `write` function.
     * It is called by winston for each transport in order to output the log
     * through whatever medium.
     * 
     * @param {Map} msg Map including log level, message and metadata.
     * @returns {void}
    */
    write(msg) {
      this.log(msg);
    }

    get tempLevel() {
      return this._tempLevel;
    }

    set tempLevel(val) {
      this._tempLevel = val;
    }

    get logger() {
      return this._logger;
    }

    set logger(obj) {
      this._logger = obj;
    }

    get level() {
      const [, lvlName] = this.logger.toLevel(this.logger.minLevel);

      return lvlName;
    }

    set level(val) {
      if (!this.logger) {
        this.tempLevel = val;
      } else {
        this.logger.minLevel = val;
      }
    }

    get levels() {
      return this.logger.levels.reduce((acc, lvlName, lvlNum) => {
        const newAcc = acc;

        newAcc[lvlName] = lvlNum;

        return newAcc;
      }, {});
    }

    /**
     * Set logger levels passed from winston.
     * 
     * @param {Map} val Logger levels
     * @returns {void}
    */
    set levels(val) {
      //  This function is used by winston to set Logger levels
      //  In this library we use the format [ <levelname>, <levelname>... ]
      //  where the index is indicative of the logging number.
      //
      //  Winston uses reversed logging numbers where
      //  lower number = highest priority.
      //  It also uses the { '<level>': <num> } format so here we
      //  turn the dictionary into an array and reverse it to bring it to our format
      //
      //  Keys are also always provided in the same order.
      this.logger.levels = Object.keys(val).reverse();
      //  Winston sets logger levels which are different from the ones we use.
      //  It does this after the construction of the InsightTransport object.
      //
      //  Therefore we need to update the minLevel in order to make sure it's correct for dropping log messages
      //  which are less important than the current logging level.
      //  If we don't do this we will be using different levels against a stale/incorrect minLevel.
      this.logger.minLevel = this.minLevel;
    }
  }

  return InsightTransport;
}

module.exports = generateTransport;
