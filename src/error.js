/**
 * InsightError class which extends error.  
 * Used for formatting and logging errors which occur within the library.  
 * Automatically captures error stack trace.
 */
class InsightError extends Error {
  /**
   * Constructs an InsightError with the passed message
   * @constructor
   * @param {String} msg Error message
  */
  constructor(message) {
    super(message);

    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.message = message;
  }
}

module.exports = InsightError;
