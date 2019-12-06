const _ = require('lodash');
const stringify = require('json-stringify-safe');

const {Logger} = require('./logger');

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
      this.json = opts.json || false;

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
      //  If we have specified to log in JSON format, then stringify
      //
      //  Also, if the `info` object which is passed from winston has more
      //  that 2 default keys (`message` and `level`), then that means that
      //  the `log` function was called with more two than keys
      //  (referred to as metadata), so in that scenario we stringify the
      //  entire message since it is not obvious what format the user wants.
      //  
      //  log function, without being given a log (like below) will just log
      //  the level, which in this case is our message.
      if (this.json || Object.keys(info).length > 2) {
        this.logger.log(stringify(info));
      } else {
        //  If we do get the default keys of `level` and `message` then we
        //  can use the default format of `<level> <message>`
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
    }
  }

  return InsightTransport;
}

module.exports = generateTransport;
