const _ = require('lodash');
const {Writable} = require('stream');

const {bunyanLevels} = require('./defaults');
const Logger = require('./logger');

/**
 * Class representing a Bunyan Stream
 * @extends Writable
 */
class BunyanStream extends Writable {
  /**
   * Create a BunyanStream.
   * @param {Logger} logger - The Logger object which will be used for logging
  */
  constructor(logger) {
    super({
      objectMode: true
    });

    this.logger = logger;
    this.logger.on('error', (err) => this.emit(err));
  }

  /**
   * Overwrites the Writable _write method which is called by Writable.  
   * Calls our log function which sends logs to the Insight Platform.
  */
  _write(log, enc, cb) {
    const lvl = (log.level / 10) - 1;

    this.logger.log(lvl, log);

    setImmediate(cb);
  }

  get logger() {
    return this._logger;
  }

  set logger(obj) {
    this._logger = obj;
  }
}

/**
 * Prepare a BunyanStream.  
 * This handles ensuring the correct bunyan applicable options are set correctly.
 * @param opts Logger options
 * @returns {Map<String, *>} Returns Map with following:  
 * { level: { * }, name: { String }, stream: { BunyanStream }, type: { String } }
 */
function buildBunyanStream(opts) {
  //  Construct logger options
  const loggerOpts = _.clone(opts || {});

  loggerOpts.timestamp = false;
  loggerOpts.levels = opts.levels || bunyanLevels;

  //  Construct logger
  const logger = new Logger(loggerOpts);

  //  Setup BunyanStream
  const stream = new BunyanStream(logger);

  const [, level] = stream.logger.toLevel(stream.logger.minLevel);

  // Defer to Bunyan’s handling of minLevel
  stream.logger.minLevel = 0;

  return {
    level,
    name: 'insight',
    stream,
    type: 'raw',
  };
}

module.exports = buildBunyanStream;
