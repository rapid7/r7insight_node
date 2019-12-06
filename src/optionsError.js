const InsightError = require('./error');

/**
 * BadOptionsError class which extends InsightError.  
 * Logs errors regarding bad options provided to Loggers
 * @extends InsightError
 */
class BadOptionsError extends InsightError {
  /**
   * Constructs a BadOptionsError with the passed message
   * @constructor
   * @param {Map} opts Invalid options passed into the Logger
   * @param {String} msg Error message
  */
  constructor(opts, msg) {
    super(msg);

    this.options = opts;
  }
}

module.exports = BadOptionsError;
